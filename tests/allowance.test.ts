/**
 * Program tests in LiteSVM: one per rule, plus the reputation gate and
 * approval voucher. Run after `anchor build`:  npm run test:program
 *
 * Refusals are asserted by error name in the program logs
 * ("Error Code: OverRequestCap"), so a failure says which rule fired.
 */
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Clock, FailedTransactionMetadata, LiteSVM } from "./svm";

const ROOT = join(__dirname, "..");
const idl = JSON.parse(readFileSync(join(ROOT, "target/idl/allowance.json"), "utf8"));
const PROGRAM_ID = new PublicKey(idl.address);

const REGISTRY_PROGRAM_ID = new PublicKey("8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C");
const ATOM_ENGINE_PROGRAM_ID = new PublicKey("AToMufS4QD6hEXvcvBDg9m1AHeCLpmZQsyfYa5h9MwAF");
const AGENT_DISC = Buffer.from([241, 119, 69, 140, 233, 9, 112, 50]);
const STATS_DISC = Buffer.from([190, 187, 50, 59, 203, 39, 136, 244]);

const USDC = (n: number) => new BN(Math.round(n * 1_000_000));
const DAY = 86_400n;

// ---------- harness ----------

const svm = new LiteSVM();
svm.addProgramFromFile(PROGRAM_ID, join(ROOT, "target/deploy/allowance.so"));

// Program used only to build instructions (accountsStrict: no RPC lookups).
const program = new Program(idl as anchor.Idl, {
  connection: {} as never,
} as anchor.Provider);

function send(ixs: TransactionInstruction[], signers: Keypair[]) {
  if (process.env.TRACE) process.stderr.write(`send ${ixs.length} ix by ${signers[0].publicKey.toBase58().slice(0,4)}
`);
  const tx = new Transaction();
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = signers[0].publicKey;
  tx.add(...ixs);
  tx.sign(...signers);
  const res = svm.sendTransaction(tx);
  svm.expireBlockhash();
  return res;
}

function ok(ixs: TransactionInstruction[], signers: Keypair[]) {
  const res = send(ixs, signers);
  if (res instanceof FailedTransactionMetadata) {
    assert.fail(`expected success, got ${res.err()}\n${res.meta().logs().join("\n")}`);
  }
  return res;
}

function refused(ixs: TransactionInstruction[], signers: Keypair[], errorName: string) {
  const res = send(ixs, signers);
  assert.ok(res instanceof FailedTransactionMetadata, `expected ${errorName}, but it succeeded`);
  const logs = res.meta().logs().join("\n");
  assert.match(logs, new RegExp(`Error Code: ${errorName}\\b`), `expected ${errorName}, logs:\n${logs}`);
}

function fund(kp: Keypair, sol = 10) {
  svm.airdrop(kp.publicKey, BigInt(sol * LAMPORTS_PER_SOL));
}

function tokenBalance(ata: PublicKey): bigint {
  const acc = svm.getAccount(ata);
  if (!acc) return 0n;
  return Buffer.from(acc.data).readBigUInt64LE(64);
}

function now(): bigint {
  return svm.getClock().unixTimestamp;
}

function warp(seconds: bigint) {
  const c = svm.getClock();
  svm.setClock(
    new Clock(c.slot + 1n, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch, c.unixTimestamp + seconds),
  );
}

async function fetchSession(addr: PublicKey) {
  const acc = svm.getAccount(addr)!;
  return program.coder.accounts.decode("session", Buffer.from(acc.data));
}

async function fetchPending(addr: PublicKey) {
  const acc = svm.getAccount(addr)!;
  return program.coder.accounts.decode("pending", Buffer.from(acc.data));
}

/** Writes fake 8004 registry accounts for a merchant with a given score (0..100). */
function setReputation(merchant: PublicKey, score: number, feedbackCount = 5n) {
  const asset = Keypair.generate().publicKey;

  const agent = Buffer.alloc(400);
  AGENT_DISC.copy(agent, 0);
  asset.toBuffer().copy(agent, 104);
  agent[138] = 1; // Some(
  merchant.toBuffer().copy(agent, 139); // agent_wallet)
  const agentAddr = Keypair.generate().publicKey;
  svm.setAccount(agentAddr, {
    lamports: LAMPORTS_PER_SOL,
    data: agent,
    owner: REGISTRY_PROGRAM_ID,
    executable: false,
  });

  const stats = Buffer.alloc(600);
  STATS_DISC.copy(stats, 0);
  asset.toBuffer().copy(stats, 40);
  stats.writeBigUInt64LE(feedbackCount, 88);
  stats.writeUInt16LE(score * 100, 98); // ema_score_slow
  const statsAddr = Keypair.generate().publicKey;
  svm.setAccount(statsAddr, {
    lamports: LAMPORTS_PER_SOL,
    data: stats,
    owner: ATOM_ENGINE_PROGRAM_ID,
    executable: false,
  });

  return { registryAgent: agentAddr, atomStats: statsAddr };
}

// ---------- fixture ----------

const owner = Keypair.generate();
const agent = Keypair.generate();
const stranger = Keypair.generate();
const mintKp = Keypair.generate();
const mint = mintKp.publicKey;
const merchantA = Keypair.generate().publicKey; // listed, 1/day
const merchantB = Keypair.generate().publicKey; // unlisted, score 85
const merchantC = Keypair.generate().publicKey; // unlisted, score 40

const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), owner.publicKey.toBuffer()], PROGRAM_ID);
const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
const ownerAta = getAssociatedTokenAddressSync(mint, owner.publicKey);
const ataOf = (w: PublicKey) => getAssociatedTokenAddressSync(mint, w, true);

const sessionPda = (a: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("session"), vault.toBuffer(), a.toBuffer()], PROGRAM_ID)[0];
const pendingPda = (session: PublicKey, createdAt: BN, nonce: number) =>
  PublicKey.findProgramAddressSync(
    [
      Buffer.from("pending"),
      session.toBuffer(),
      createdAt.toArrayLike(Buffer, "le", 8),
      new BN(nonce).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  )[0];

let repB: ReturnType<typeof setReputation>;
let repC: ReturnType<typeof setReputation>;

async function createSession(agentKey: PublicKey, overrides: Partial<Record<string, unknown>> = {}) {
  const params = {
    perRequestCap: USDC(0.05),
    dailyCap: USDC(2),
    otherDailyCap: USDC(0.5),
    minReputation: 70,
    expiresAt: new BN((now() + 3600n).toString()),
    merchants: [{ merchant: merchantA, label: "Merchant A", dailyCap: USDC(1) }],
    ...overrides,
  };
  return program.methods
    .createSession(params)
    .accountsStrict({
      owner: owner.publicKey,
      vault,
      agent: agentKey,
      session: sessionPda(agentKey),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

type PayOpts = {
  signer?: Keypair;
  session?: PublicKey;
  merchant?: PublicKey;
  merchantAta?: PublicKey;
  rep?: { registryAgent: PublicKey; atomStats: PublicKey } | null;
  pending?: PublicKey | null;
};

async function pay(amount: number, reason: string, o: PayOpts = {}) {
  const signer = o.signer ?? agent;
  const merchant = o.merchant ?? merchantA;
  return program.methods
    .agentPay(USDC(amount), reason)
    .accountsStrict({
      agent: signer.publicKey,
      vault,
      session: o.session ?? sessionPda(agent.publicKey),
      mint,
      vaultAta,
      merchant,
      merchantAta: o.merchantAta ?? ataOf(merchant),
      registryAgent: o.rep?.registryAgent ?? null,
      atomStats: o.rep?.atomStats ?? null,
      pending: o.pending ?? null,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

async function setFrozen(frozen: boolean, signer = owner) {
  const m = frozen ? program.methods.freezeAll() : program.methods.unfreeze();
  return m.accountsStrict({ owner: signer.publicKey, vault }).instruction();
}

before(async () => {
  for (const kp of [owner, agent, stranger]) fund(kp);

  // 6-decimal test mint, owner holds 100
  const rent = svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
  ok(
    [
      SystemProgram.createAccount({
        fromPubkey: owner.publicKey,
        newAccountPubkey: mint,
        lamports: Number(rent),
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint, 6, owner.publicKey, null),
      createAssociatedTokenAccountIdempotentInstruction(owner.publicKey, ownerAta, owner.publicKey, mint),
      createMintToInstruction(mint, ownerAta, owner.publicKey, 100_000_000n),
      ...[merchantA, merchantB, merchantC].map((m) =>
        createAssociatedTokenAccountIdempotentInstruction(owner.publicKey, ataOf(m), m, mint),
      ),
    ],
    [owner, mintKp],
  );

  ok(
    [
      await program.methods
        .initVault()
        .accountsStrict({
          owner: owner.publicKey,
          vault,
          mint,
          vaultAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    ],
    [owner],
  );
  ok(
    [
      await program.methods
        .deposit(USDC(20))
        .accountsStrict({ owner: owner.publicKey, vault, mint, ownerAta, vaultAta, tokenProgram: TOKEN_PROGRAM_ID })
        .instruction(),
    ],
    [owner],
  );
  ok([await createSession(agent.publicKey, { expiresAt: new BN((now() + 30n * DAY).toString()) })], [owner]);

  repB = setReputation(merchantB, 85);
  repC = setReputation(merchantC, 40);
});

// ---------- tests ----------

describe("agent_pay", () => {
  it("pays a listed merchant within every cap and records the reason", async () => {
    const before = tokenBalance(ataOf(merchantA));
    const res = ok([await pay(0.01, "Summarize solana.com for the user")], [agent]);
    assert.equal(tokenBalance(ataOf(merchantA)) - before, 10_000n);
    assert.equal(tokenBalance(vaultAta), 19_990_000n);
    const s = await fetchSession(sessionPda(agent.publicKey));
    assert.equal(s.spentToday.toString(), "10000");
    assert.match(res.logs().join("\n"), /Program data: /); // PaymentMade event emitted
  });

  it("refuses over the per-request cap", async () => {
    refused([await pay(0.06, "premium report")], [agent], "OverRequestCap");
  });

  it("refuses an empty or oversized reason", async () => {
    refused([await pay(0.01, "  ")], [agent], "ReasonMissing");
    refused([await pay(0.01, "x".repeat(201))], [agent], "ReasonTooLong");
  });

  it("refuses a zero amount", async () => {
    refused([await pay(0, "nothing")], [agent], "ZeroAmount");
  });

  it("refuses a different signer as agent", async () => {
    refused([await pay(0.01, "not me", { signer: stranger })], [stranger], "NotAgent");
  });

  it("refuses redirecting money to a token account the merchant doesn't own", async () => {
    const res = send([await pay(0.01, "redirect", { merchantAta: ataOf(merchantB) })], [agent]);
    assert.ok(res instanceof FailedTransactionMetadata);
    assert.match(res.meta().logs().join("\n"), /ConstraintAssociated|ConstraintTokenOwner|AnchorError/);
  });

  it("pays an unlisted merchant above the reputation minimum", async () => {
    const before = tokenBalance(ataOf(merchantB));
    ok([await pay(0.01, "market data", { merchant: merchantB, rep: repB })], [agent]);
    assert.equal(tokenBalance(ataOf(merchantB)) - before, 10_000n);
    const s = await fetchSession(sessionPda(agent.publicKey));
    assert.equal(s.otherSpentToday.toString(), "10000");
  });

  it("refuses an unlisted merchant below the reputation minimum", async () => {
    refused([await pay(0.01, "sketchy data", { merchant: merchantC, rep: repC })], [agent], "LowReputation");
  });

  it("refuses an unlisted merchant without reputation accounts", async () => {
    refused([await pay(0.01, "no rep", { merchant: merchantB })], [agent], "ReputationAccountMissing");
  });

  it("refuses another merchant's reputation accounts", async () => {
    refused([await pay(0.01, "borrowed rep", { merchant: merchantC, rep: repB })], [agent], "BadReputationAccount");
  });

  it("refuses reputation accounts not owned by the registry programs", async () => {
    const fake = Keypair.generate().publicKey;
    const data = Buffer.alloc(400);
    AGENT_DISC.copy(data, 0);
    data[138] = 1;
    merchantC.toBuffer().copy(data, 139);
    svm.setAccount(fake, { lamports: LAMPORTS_PER_SOL, data, owner: SystemProgram.programId, executable: false });
    refused(
      [await pay(0.01, "forged rep", { merchant: merchantC, rep: { registryAgent: fake, atomStats: repC.atomStats } })],
      [agent],
      "BadReputationAccount",
    );
  });

  it("refuses past a listed merchant's daily cap", async () => {
    // A is at 0.01 of 1.00; 19 x 0.05 = 0.95 brings it to 0.96, then 0.05 more passes 1.00
    for (let i = 0; i < 19; i++) ok([await pay(0.05, `summary ${i}`)], [agent]);
    refused([await pay(0.05, "one too many")], [agent], "OverMerchantCap");
  });

  it("refuses past the shared cap for unlisted merchants", async () => {
    // B is at 0.01 of 0.50 other-cap
    for (let i = 0; i < 9; i++) ok([await pay(0.05, `data ${i}`, { merchant: merchantB, rep: repB })], [agent]);
    refused([await pay(0.05, "over other cap", { merchant: merchantB, rep: repB })], [agent], "OverOtherCap");
  });

  it("refuses past the session's daily cap", async () => {
    // spent today: A 0.96 + B 0.46 = 1.42 of 2.00. Raise caps in a fresh session to isolate the daily cap.
    const agent2 = Keypair.generate();
    fund(agent2);
    ok(
      [
        await createSession(agent2.publicKey, {
          dailyCap: USDC(0.1),
          perRequestCap: USDC(0.05),
          merchants: [{ merchant: merchantA, label: "A", dailyCap: USDC(1) }],
        }),
      ],
      [owner],
    );
    const s2 = sessionPda(agent2.publicKey);
    ok([await pay(0.05, "one", { signer: agent2, session: s2 })], [agent2]);
    ok([await pay(0.05, "two", { signer: agent2, session: s2 })], [agent2]);
    refused([await pay(0.01, "three", { signer: agent2, session: s2 })], [agent2], "OverDailyCap");
  });

  it("resets the daily counters after 24 hours", async () => {
    refused([await pay(0.05, "still today")], [agent], "OverMerchantCap");
    warp(DAY);
    ok([await pay(0.05, "a new day")], [agent]);
    const s = await fetchSession(sessionPda(agent.publicKey));
    assert.equal(s.spentToday.toString(), "50000");
  });
});

describe("create_session", () => {
  it("stores the current time in day_start and zeroes every counter", async () => {
    const agent7 = Keypair.generate();
    const at = now();
    ok([await createSession(agent7.publicKey)], [owner]);
    const s = await fetchSession(sessionPda(agent7.publicKey));
    assert.equal(s.dayStart.toString(), at.toString());
    assert.equal(s.createdAt.toString(), at.toString());
    assert.equal(s.spentToday.toString(), "0");
    assert.equal(s.otherSpentToday.toString(), "0");
    assert.equal(s.totalPaid.toString(), "0");
    for (const m of s.merchants) assert.equal(m.spentToday.toString(), "0");
  });
});

describe("refusing unlisted merchants", () => {
  it("refuses any unlisted merchant when the other-merchant cap is 0", async () => {
    const agent3 = Keypair.generate();
    fund(agent3);
    ok([await createSession(agent3.publicKey, { otherDailyCap: USDC(0), expiresAt: new BN((now() + 3600n).toString()) })], [owner]);
    refused(
      [await pay(0.01, "unlisted", { signer: agent3, session: sessionPda(agent3.publicKey), merchant: merchantB, rep: repB })],
      [agent3],
      "NotListed",
    );
  });
});

describe("kill switch, revoke and expiry", () => {
  it("freeze_all blocks payments and unfreeze restores them", async () => {
    ok([await setFrozen(true)], [owner]);
    refused([await pay(0.01, "while frozen")], [agent], "Frozen");
    ok([await setFrozen(false)], [owner]);
    ok([await pay(0.01, "after unfreeze")], [agent]);
  });

  it("withdraw works while frozen", async () => {
    ok([await setFrozen(true)], [owner]);
    ok(
      [
        await program.methods
          .withdraw(USDC(1))
          .accountsStrict({ owner: owner.publicKey, vault, mint, ownerAta, vaultAta, tokenProgram: TOKEN_PROGRAM_ID })
          .instruction(),
      ],
      [owner],
    );
    ok([await setFrozen(false)], [owner]);
  });

  it("only the owner can freeze or withdraw", async () => {
    refused([await setFrozen(true, agent)], [agent], "NotOwner");
    refused(
      [
        await program.methods
          .withdraw(USDC(1))
          .accountsStrict({
            owner: agent.publicKey,
            vault,
            mint,
            ownerAta, // an existing account, so the owner check is what fails
            vaultAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ],
      [agent],
      "NotOwner",
    );
  });

  it("refuses a session that has expired", async () => {
    const agent4 = Keypair.generate();
    fund(agent4);
    ok([await createSession(agent4.publicKey, { expiresAt: new BN((now() + 60n).toString()) })], [owner]);
    warp(61n);
    refused([await pay(0.01, "too late", { signer: agent4, session: sessionPda(agent4.publicKey) })], [agent4], "Expired");
  });

  it("refuses creating a session that already expired", async () => {
    const agent5 = Keypair.generate();
    refused([await createSession(agent5.publicKey, { expiresAt: new BN((now() - 1n).toString()) })], [owner], "BadExpiry");
  });

  it("revoke_session stops the agent, and the session can then be closed", async () => {
    const agent6 = Keypair.generate();
    fund(agent6);
    const s6 = sessionPda(agent6.publicKey);
    ok([await createSession(agent6.publicKey)], [owner]);
    const closeIx = await program.methods
      .closeSession()
      .accountsStrict({ owner: owner.publicKey, vault, session: s6 })
      .instruction();
    refused([closeIx], [owner], "SessionStillActive");
    ok(
      [await program.methods.revokeSession().accountsStrict({ owner: owner.publicKey, vault, session: s6 }).instruction()],
      [owner],
    );
    refused([await pay(0.01, "revoked", { signer: agent6, session: s6 })], [agent6], "Revoked");
    ok([closeIx], [owner]);
    assert.equal(svm.getAccount(s6)?.lamports ?? 0, 0);
  });
});

describe("over-cap approvals", () => {
  const session = () => sessionPda(agent.publicKey);
  let pending: PublicKey;

  async function request(amount: number) {
    const s = await fetchSession(session());
    const addr = pendingPda(session(), s.createdAt, Number(s.pendingNonce));
    const ix = await program.methods
      .requestApproval(USDC(amount), "Full premium report for the quarterly review")
      .accountsStrict({
        agent: agent.publicKey,
        vault,
        session: session(),
        merchant: merchantA,
        pending: addr,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    ok([ix], [agent]);
    return addr;
  }

  const resolve = async (addr: PublicKey, approve: boolean, signer = owner) =>
    (approve ? program.methods.approvePending() : program.methods.rejectPending())
      .accountsStrict({ owner: signer.publicKey, vault, session: session(), pending: addr })
      .instruction();

  it("an open request is not yet a voucher", async () => {
    warp(DAY); // fresh daily caps
    pending = await request(0.5);
    refused([await pay(0.5, "premium report", { pending })], [agent], "PendingNotApproved");
  });

  it("only the owner can approve", async () => {
    refused([await resolve(pending, true, agent)], [agent], "NotOwner");
  });

  it("an approved request pays once, over the per-request cap", async () => {
    ok([await resolve(pending, true)], [owner]);
    const before = tokenBalance(ataOf(merchantA));
    ok([await pay(0.5, "premium report", { pending })], [agent]);
    assert.equal(tokenBalance(ataOf(merchantA)) - before, 500_000n);
    const p = await fetchPending(pending);
    assert.deepEqual(Object.keys(p.status), ["used"]);
    refused([await pay(0.5, "again", { pending })], [agent], "PendingNotApproved");
  });

  it("a voucher must match the amount and merchant", async () => {
    const p2 = await request(0.4);
    ok([await resolve(p2, true)], [owner]);
    refused([await pay(0.3, "different amount", { pending: p2 })], [agent], "PendingMismatch");
    refused([await pay(0.4, "different merchant", { pending: p2, merchant: merchantB, rep: repB })], [agent], "PendingMismatch");
  });

  it("a rejected request can't be approved later", async () => {
    const p3 = await request(0.2);
    ok([await resolve(p3, false)], [owner]);
    refused([await resolve(p3, true)], [owner], "PendingNotOpen");
  });
});

describe("recreating a session for the same agent", () => {
  it("gets fresh approval addresses instead of colliding with the old session's", async () => {
    const agent8 = Keypair.generate();
    fund(agent8);
    const s8 = sessionPda(agent8.publicKey);

    const ask = async () => {
      const s = await fetchSession(s8);
      const addr = pendingPda(s8, s.createdAt, Number(s.pendingNonce));
      ok(
        [
          await program.methods
            .requestApproval(USDC(0.5), "Over-cap request")
            .accountsStrict({
              agent: agent8.publicKey,
              vault,
              session: s8,
              merchant: merchantA,
              pending: addr,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ],
        [agent8],
      );
      return addr;
    };

    ok([await createSession(agent8.publicKey)], [owner]);
    const first = await ask();

    ok(
      [
        await program.methods.revokeSession().accountsStrict({ owner: owner.publicKey, vault, session: s8 }).instruction(),
        await program.methods.closeSession().accountsStrict({ owner: owner.publicKey, vault, session: s8 }).instruction(),
      ],
      [owner],
    );
    warp(1n);
    ok([await createSession(agent8.publicKey)], [owner]);
    const second = await ask(); // nonce is 0 again; created_at keeps the address new
    assert.notEqual(second.toBase58(), first.toBase58());
    assert.ok(svm.getAccount(first), "the old request stays on-chain");
  });
});
