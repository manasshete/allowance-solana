/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/allowance.json`.
 */
export type Allowance = {
  "address": "83eetVkGiCvyFw452uNiBhf6UtKnj4XKDjAUrQArFaQL",
  "metadata": {
    "name": "allowance",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "An on-chain spending firewall for AI agents paying over x402"
  },
  "instructions": [
    {
      "name": "agentPay",
      "discriminator": [
        191,
        210,
        112,
        56,
        82,
        215,
        140,
        233
      ],
      "accounts": [
        {
          "name": "agent",
          "signer": true,
          "relations": [
            "session"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "session"
          ]
        },
        {
          "name": "session",
          "writable": true,
          "relations": [
            "pending"
          ]
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "merchant"
        },
        {
          "name": "merchantAta",
          "docs": [
            "The merchant's associated token account, so the money can only land",
            "where an x402 facilitator expects it."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "merchant"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "registryAgent",
          "optional": true
        },
        {
          "name": "atomStats",
          "optional": true
        },
        {
          "name": "pending",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "approvePending",
      "discriminator": [
        171,
        11,
        173,
        28,
        199,
        199,
        129,
        178
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "session"
          ]
        },
        {
          "name": "session",
          "relations": [
            "pending"
          ]
        },
        {
          "name": "pending",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "closeSession",
      "discriminator": [
        68,
        114,
        178,
        140,
        222,
        38,
        248,
        211
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "session"
          ]
        },
        {
          "name": "session",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "createSession",
      "discriminator": [
        242,
        193,
        143,
        179,
        150,
        25,
        122,
        227
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "agent"
        },
        {
          "name": "session",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "sessionParams"
            }
          }
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault"
        },
        {
          "name": "mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "ownerAta",
          "writable": true
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "freezeAll",
      "discriminator": [
        187,
        113,
        158,
        131,
        118,
        61,
        214,
        69
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "initVault",
      "discriminator": [
        77,
        79,
        85,
        150,
        33,
        217,
        52,
        106
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "rejectPending",
      "discriminator": [
        238,
        90,
        25,
        174,
        160,
        197,
        129,
        146
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "session"
          ]
        },
        {
          "name": "session",
          "relations": [
            "pending"
          ]
        },
        {
          "name": "pending",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "requestApproval",
      "discriminator": [
        14,
        31,
        134,
        78,
        89,
        175,
        45,
        157
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "signer": true,
          "relations": [
            "session"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "session"
          ]
        },
        {
          "name": "session",
          "writable": true
        },
        {
          "name": "merchant"
        },
        {
          "name": "pending",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "session"
              },
              {
                "kind": "account",
                "path": "session.pending_nonce",
                "account": "session"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "revokeSession",
      "discriminator": [
        86,
        92,
        198,
        120,
        144,
        2,
        7,
        194
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "relations": [
            "session"
          ]
        },
        {
          "name": "session",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "unfreeze",
      "discriminator": [
        133,
        160,
        68,
        253,
        80,
        232,
        218,
        247
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "vault"
        },
        {
          "name": "mint",
          "relations": [
            "vault"
          ]
        },
        {
          "name": "ownerAta",
          "writable": true
        },
        {
          "name": "vaultAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "pending",
      "discriminator": [
        36,
        180,
        147,
        170,
        72,
        175,
        173,
        126
      ]
    },
    {
      "name": "session",
      "discriminator": [
        243,
        81,
        72,
        115,
        214,
        188,
        72,
        144
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "fundsMoved",
      "discriminator": [
        45,
        213,
        142,
        27,
        233,
        76,
        210,
        8
      ]
    },
    {
      "name": "paymentMade",
      "discriminator": [
        227,
        251,
        123,
        16,
        133,
        220,
        83,
        242
      ]
    },
    {
      "name": "pendingCreated",
      "discriminator": [
        102,
        221,
        227,
        180,
        16,
        127,
        15,
        171
      ]
    },
    {
      "name": "pendingResolved",
      "discriminator": [
        11,
        160,
        50,
        191,
        26,
        122,
        101,
        26
      ]
    },
    {
      "name": "sessionCreated",
      "discriminator": [
        107,
        111,
        254,
        25,
        21,
        122,
        220,
        225
      ]
    },
    {
      "name": "sessionRevoked",
      "discriminator": [
        90,
        48,
        35,
        234,
        203,
        192,
        126,
        211
      ]
    },
    {
      "name": "vaultFrozen",
      "discriminator": [
        13,
        199,
        172,
        111,
        88,
        10,
        151,
        247
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "frozen",
      "msg": "The vault is frozen"
    },
    {
      "code": 6001,
      "name": "revoked",
      "msg": "The session was revoked"
    },
    {
      "code": 6002,
      "name": "expired",
      "msg": "The session has expired"
    },
    {
      "code": 6003,
      "name": "zeroAmount",
      "msg": "Amount must be above zero"
    },
    {
      "code": 6004,
      "name": "reasonMissing",
      "msg": "A reason is required"
    },
    {
      "code": 6005,
      "name": "reasonTooLong",
      "msg": "Reason is longer than 200 bytes"
    },
    {
      "code": 6006,
      "name": "overRequestCap",
      "msg": "Amount is over the per-request cap"
    },
    {
      "code": 6007,
      "name": "overDailyCap",
      "msg": "Amount would pass the session's daily cap"
    },
    {
      "code": 6008,
      "name": "overMerchantCap",
      "msg": "Amount would pass this merchant's daily cap"
    },
    {
      "code": 6009,
      "name": "overOtherCap",
      "msg": "Amount would pass the daily cap for unlisted merchants"
    },
    {
      "code": 6010,
      "name": "notListed",
      "msg": "Merchant is not listed and unlisted merchants are not allowed"
    },
    {
      "code": 6011,
      "name": "reputationAccountMissing",
      "msg": "Unlisted merchant: reputation accounts are required"
    },
    {
      "code": 6012,
      "name": "badReputationAccount",
      "msg": "Reputation accounts are not the registry's or not this merchant's"
    },
    {
      "code": 6013,
      "name": "lowReputation",
      "msg": "Merchant's reputation is below the session minimum"
    },
    {
      "code": 6014,
      "name": "pendingMismatch",
      "msg": "Pending request does not match this payment"
    },
    {
      "code": 6015,
      "name": "pendingNotApproved",
      "msg": "Pending request is not approved"
    },
    {
      "code": 6016,
      "name": "pendingNotOpen",
      "msg": "Pending request is already resolved"
    },
    {
      "code": 6017,
      "name": "tooManyMerchants",
      "msg": "At most 5 listed merchants"
    },
    {
      "code": 6018,
      "name": "badExpiry",
      "msg": "Expiry must be in the future"
    },
    {
      "code": 6019,
      "name": "badCaps",
      "msg": "Caps must be above zero, per-request at most daily, reputation at most 100"
    },
    {
      "code": 6020,
      "name": "labelTooLong",
      "msg": "Merchant label is longer than 24 bytes"
    },
    {
      "code": 6021,
      "name": "duplicateMerchant",
      "msg": "Merchant listed twice"
    },
    {
      "code": 6022,
      "name": "notOwner",
      "msg": "Only the vault owner can do this"
    },
    {
      "code": 6023,
      "name": "notAgent",
      "msg": "Only the session's agent can do this"
    },
    {
      "code": 6024,
      "name": "sessionStillActive",
      "msg": "Revoke the session or wait for it to expire first"
    },
    {
      "code": 6025,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "fundsMoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "deposit",
            "type": "bool"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "merchantCap",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merchant",
            "docs": [
              "The payTo wallet (owner of the merchant's token account)."
            ],
            "type": "pubkey"
          },
          {
            "name": "label",
            "type": "string"
          },
          {
            "name": "dailyCap",
            "type": "u64"
          },
          {
            "name": "spentToday",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "merchantInput",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "label",
            "type": "string"
          },
          {
            "name": "dailyCap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "paymentMade",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "pending",
            "docs": [
              "Set when an approved over-cap request was used as a voucher."
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "reputation",
            "docs": [
              "Some(score) when the merchant was unlisted and passed the reputation gate."
            ],
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "spentToday",
            "type": "u64"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pending",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "pendingStatus"
              }
            }
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pendingCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "pending",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pendingResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "pending",
            "type": "pubkey"
          },
          {
            "name": "approved",
            "type": "bool"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pendingStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          },
          {
            "name": "used"
          }
        ]
      }
    },
    {
      "name": "session",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "perRequestCap",
            "type": "u64"
          },
          {
            "name": "dailyCap",
            "type": "u64"
          },
          {
            "name": "spentToday",
            "type": "u64"
          },
          {
            "name": "otherDailyCap",
            "docs": [
              "Daily cap shared by merchants not listed below; 0 means unlisted merchants are refused."
            ],
            "type": "u64"
          },
          {
            "name": "otherSpentToday",
            "type": "u64"
          },
          {
            "name": "minReputation",
            "docs": [
              "Minimum Agent Registry score (0..=100) for unlisted merchants."
            ],
            "type": "u8"
          },
          {
            "name": "dayStart",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "revoked",
            "type": "bool"
          },
          {
            "name": "totalPaid",
            "type": "u64"
          },
          {
            "name": "pendingNonce",
            "type": "u64"
          },
          {
            "name": "merchants",
            "type": {
              "vec": {
                "defined": {
                  "name": "merchantCap"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "sessionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "sessionParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "perRequestCap",
            "type": "u64"
          },
          {
            "name": "dailyCap",
            "type": "u64"
          },
          {
            "name": "otherDailyCap",
            "type": "u64"
          },
          {
            "name": "minReputation",
            "type": "u8"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "merchants",
            "type": {
              "vec": {
                "defined": {
                  "name": "merchantInput"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "sessionRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "frozen",
            "docs": [
              "Kill switch: blocks every agent_pay and request_approval for every session."
            ],
            "type": "bool"
          },
          {
            "name": "sessionCount",
            "docs": [
              "Sessions ever created, for the dashboard."
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultFrozen",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "frozen",
            "type": "bool"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
