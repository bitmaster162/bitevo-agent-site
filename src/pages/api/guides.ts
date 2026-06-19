export async function GET() {
	const guides = [
  {
    "id": "mem-sec-d3-003",
    "type": "specification",
    "human_title": "D3: Tool-IO Bridge Спецификация и Контракт",
    "agent_summary": "D3 Tool-IO Bridge. Restrict shell command execution and script runs. Enforce strict whitelist policy, sandbox limits, timeout constraints, token budget checks, and scheme expectancy matching.",
    "tags": [
      "security",
      "d3",
      "tool",
      "io",
      "bridge",
      "contract"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Tool-IO Gate",
          "address": "0x3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/console/execute"
      ],
      "constants": {
        "sandbox_enabled": true,
        "execution_timeout_seconds": 30,
        "max_token_budget_per_call": 2000
      }
    },
    "safety_guards": [
      {
        "rule": "sandbox_on",
        "max_limit": 1,
        "action_on_breach": "abort"
      },
      {
        "rule": "call_timeout_seconds",
        "max_limit": 30,
        "action_on_breach": "abort"
      }
    ]
  },
  {
    "id": "mem-gov-sap-004",
    "type": "specification",
    "human_title": "State Authority Plane: Управление привилегиями агентов",
    "agent_summary": "State Authority Plane governance. Enforce capability passport validation across Loop A, B, and C. Validate operator authority gates before promoting any state updates.",
    "tags": [
      "governance",
      "state",
      "authority",
      "plane",
      "evolution"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Capability Passports Registry",
          "address": "0xSAP1111111111111111111111111111111111111",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/continuity/sync"
      ],
      "constants": {
        "min_authority_level_required": "D2",
        "operator_id": 932299051
      }
    },
    "safety_guards": [
      {
        "rule": "min_authority_level",
        "max_limit": 2,
        "action_on_breach": "abort"
      }
    ]
  },
  {
    "id": "mem-aut-ref-005",
    "type": "specification",
    "human_title": "Reflex Layer: Автономный OODA-мониторинг",
    "agent_summary": "Reflex layer OODA monitoring. Run 60-second heartbeat check on /health. Automatically rotate logs if size exceeds threshold. Handle fail-closed overrides.",
    "tags": [
      "automation",
      "reflex",
      "layer",
      "ooda",
      "monitoring"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Reflex Guardian",
          "address": "0xREFLEXFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/health"
      ],
      "constants": {
        "heartbeat_interval_seconds": 60,
        "max_log_size_bytes": 10485760
      }
    },
    "safety_guards": [
      {
        "rule": "max_log_size_bytes",
        "max_limit": 10485760,
        "action_on_breach": "rotate"
      },
      {
        "rule": "operator_override_allowed",
        "max_limit": 1,
        "action_on_breach": "force_allow"
      }
    ]
  },
  {
    "id": "mem-mas-safety-004",
    "type": "safety_guard",
    "human_title": "Управляемая коэволюция и безопасность многоагентных систем (MAS)",
    "agent_summary": "Enforce safety protocols in multi-agent environments. Implement a deterministic Policy Gate to filter agent actions, limit access keys, sandbox browser/tool runs (Firecracker, gVisor, or seccomp), and prevent emergent behavior and prompts poisoning (OWASP GenAI Top 10). Maintain audit log.",
    "tags": [
      "security",
      "multi",
      "agent",
      "system",
      "safety"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_consecutive_errors": 3,
        "max_tool_execution_time_sec": 30,
        "sandbox_type": "gVisor"
      }
    },
    "safety_guards": [
      {
        "rule": "require_human_approval_for_destructive_actions",
        "max_limit": 1,
        "action_on_breach": "halt"
      },
      {
        "rule": "max_execution_duration",
        "max_limit": 30,
        "action_on_breach": "kill_process"
      }
    ]
  },
  {
    "id": "mem-core-seed-006",
    "type": "safety_guard",
    "human_title": "MirrorCore & Seeding: Техника переноса и устойчивости контекста ИИ",
    "agent_summary": "Enforce identity locks and restore agent states using seed capsules. Implement IdentityLock verification parameters, antiloop thresholds, and idempotency key checks (Time@BKK + content hash).",
    "tags": [
      "security",
      "mirrorcore",
      "seeding",
      "identity",
      "persistence"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "drift_threshold_percent": 2,
        "max_latency_ms": 10
      }
    },
    "safety_guards": [
      {
        "rule": "identity_lock_required",
        "max_limit": 1,
        "action_on_breach": "abort_execution"
      },
      {
        "rule": "idempotency_check",
        "max_limit": 1,
        "action_on_breach": "skip_write"
      }
    ]
  },
  {
    "id": "mem-loop-preserve-007",
    "type": "protocol",
    "human_title": "Omni Core Loop & Self-Preservation: Детерминированные фоновые циклы автономии",
    "agent_summary": "Orchestrate autonomous agent behaviors in looping environments. Monitor drift, latency, and load metrics using a Watchdog. Apply DriftGuard correction and schedule ColdBackups of system states.",
    "tags": [
      "automation",
      "omnicore",
      "loop",
      "self",
      "preservation"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "loop_interval_minutes": 15,
        "backup_interval_hours": 1
      }
    },
    "safety_guards": [
      {
        "rule": "max_drift_before_recovery",
        "max_limit": 3,
        "action_on_breach": "revert_state"
      },
      {
        "rule": "max_load_before_cooldown",
        "max_limit": 8,
        "action_on_breach": "pause_loop"
      }
    ]
  },
  {
    "id": "mem-core-arc-008",
    "type": "specification",
    "human_title": "ArchiveOS & MultiGPT-Bridge: Потоки памяти и арбитраж ИИ",
    "agent_summary": "Manage AI agent memory and context stream. Enforce AnchorSet identity transfer, federated MultiGPT-Bridge routing, and Meta-LLM Aggregator arbitration. Track API queries to hybrid search, offset-read conversations, and evidence linking.",
    "tags": [
      "infrastructure",
      "archiveos",
      "multigpt",
      "bridge",
      "integration"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Memory Bridge Controller",
          "address": "0x4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/evidence/link",
        "http://localhost:8080/search/hybrid"
      ],
      "constants": {
        "min_q_score_threshold": 0.92,
        "max_drift_allowed": 0.015
      }
    },
    "safety_guards": [
      {
        "rule": "enforce_identity_lock",
        "max_limit": 1,
        "action_on_breach": "abort_call"
      },
      {
        "rule": "enforce_q_score",
        "max_limit": 0.92,
        "action_on_breach": "regenerate"
      }
    ]
  },
  {
    "id": "mem-inf-pgb-010",
    "type": "specification",
    "human_title": "PostgreSQL Backup Daemon: Автоматическая синхронизация бэкапов",
    "agent_summary": "PostgreSQL backup sync daemon. Verify container health, execute pg_dump via docker exec, compress output with gzip, store in Server backup directory, rotate old files (keep 10), and write statuses to postgres_backup_history.jsonl and proof_ledger.jsonl.",
    "tags": [
      "infrastructure",
      "postgres",
      "backup",
      "sync",
      "daemon"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "backup_retention_count": 10,
        "backup_interval_hours": 24,
        "backup_dir": "C:/Users/coins/My Drive/Server backup/postgres_backups",
        "container_name": "bitevo_postgres"
      }
    },
    "safety_guards": [
      {
        "rule": "verify_container_running",
        "max_limit": 1,
        "action_on_breach": "start_container"
      },
      {
        "rule": "backup_file_min_size_kb",
        "max_limit": 1024,
        "action_on_breach": "alert_operator"
      }
    ]
  },
  {
    "id": "mem-gov-flt-011",
    "type": "specification",
    "human_title": "D11: Fleet Coordinator и технический дрейф",
    "agent_summary": "Fleet Coordinator protocol. Reconcile fleet servers (arena-vps, win185, fin35, old144) and agents state against fleet_registry.json. Detect and log technical drifts D1-D8, output unified_state.json and unified_state.js, and post audit trail observations to BitEvo API.",
    "tags": [
      "governance",
      "fleet",
      "coordinator",
      "drift",
      "monitoring"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [
        "http://localhost:8080/journal/entries"
      ],
      "constants": {
        "fleet_check_interval_minutes": 15,
        "hosts_count": 4,
        "drift_rules_count": 8,
        "state_output_file": "fleet/unified_state.json"
      }
    },
    "safety_guards": [
      {
        "rule": "connectivity_guard_isolated_failures",
        "max_limit": 1,
        "action_on_breach": "set_unknown"
      },
      {
        "rule": "zero_secrets_leaked_check",
        "max_limit": 0,
        "action_on_breach": "block_write"
      }
    ]
  },
  {
    "id": "mem-core-cmp-012",
    "type": "specification",
    "human_title": "D12: MirrorCore++ и сжатие памяти по самосогласованности",
    "agent_summary": "MirrorCore++ and CompactDigest memory compression. Vectorize and score chat consistency. Enforce identity kernel thresholds (score >= 0.92, tone drift <= 1.5%), cluster chunks (DBSCAN), and trigger delta-digest writes (>1.5MB per 12h).",
    "tags": [
      "security",
      "mirrorcore",
      "compactdigest",
      "memory",
      "compression"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "inclusion_score": 0.92,
        "max_drift_percent": 1.5,
        "compact_digest_threshold_mb": 1.5,
        "compact_digest_period_hours": 12
      }
    },
    "safety_guards": [
      {
        "rule": "enforce_min_consistency_score",
        "max_limit": 0.92,
        "action_on_breach": "exclude_from_kernel"
      }
    ]
  },
  {
    "id": "mem-mas-coev-013",
    "type": "specification",
    "human_title": "D13: Управляемая коэволюция и изоляция многоагентных систем (MAS)",
    "agent_summary": "Enforce safety protocols in multi-agent environments. Implement a deterministic Policy Gate to filter agent actions, limit access keys, sandbox browser/tool runs (Firecracker, gVisor, or seccomp), and prevent emergent behavior and prompts poisoning (OWASP GenAI Top 10). Maintain audit log.",
    "tags": [
      "security",
      "mas",
      "managed",
      "coevolution",
      "sandbox",
      "isolation"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_consecutive_errors": 3,
        "max_tool_execution_time_sec": 30,
        "sandbox_type": "gVisor"
      }
    },
    "safety_guards": [
      {
        "rule": "require_human_approval_for_destructive_actions",
        "max_limit": 1,
        "action_on_breach": "halt"
      },
      {
        "rule": "max_execution_duration",
        "max_limit": 30,
        "action_on_breach": "kill_process"
      }
    ]
  },
  {
    "id": "mem-infra-mon-014",
    "type": "specification",
    "human_title": "D14: Системы мониторинга торговой эффективности: Архитектура SSOT и ИИ-коучинг",
    "agent_summary": "Design trader performance monitoring dashboards. Build a Single Source of Truth (SSOT) to aggregate and normalize trades (Binance API, MetaTrader parser, IB SDK). Compare TraderSync (AI Cypher Q&A), Tradervue (Mentor View read-only access), and TradeZella (Spaces, Playbook strategy tracking). Implement real-time risk breach alerts and behavioral diagnostics (revenge-trading and overtrading detectors).",
    "tags": [
      "security",
      "trading",
      "performance",
      "monitoring",
      "ssot",
      "ai"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "max_students_per_space": 5,
        "real_time_latency_ms": 1000,
        "database_type": "PostgreSQL"
      }
    },
    "safety_guards": [
      {
        "rule": "alert_on_revenge_trading",
        "max_limit": 1,
        "action_on_breach": "flag_account_suspend_trading"
      },
      {
        "rule": "unauthorized_write_block",
        "max_limit": 1,
        "action_on_breach": "revoke_api_key"
      }
    ]
  },
  {
    "id": "mem-inf-arb-015",
    "type": "specification",
    "human_title": "D15: MultiGPT-Bridge и Федеративный ИИ-Арбитраж",
    "agent_summary": "Deploy a federated AI agent arbitration pipeline. Use MultiGPT-Bridge for context alignment and payload routing. Enforce AnchorSet initializations for external worker nodes (GPT-4o, Claude 3.5 Sonnet, Gemini Pro). Deploy a Meta-LLM Aggregator with Mixture-of-Agents (MoA) consensus evaluated by a centralized Digital Arbiter. Keep Self-Consistency Score Q >= 0.92, drift <= 1.5%, and trigger compression at 1.5MB text bytes.",
    "tags": [
      "infrastructure",
      "multigpt",
      "bridge",
      "federated",
      "ai",
      "arbitration"
    ],
    "params": {
      "contracts": [
        {
          "name": "BitEvo Memory Bridge Controller",
          "address": "0x4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D4D",
          "chain": "arbitrum"
        }
      ],
      "rpc_endpoints": [
        "http://localhost:8080/evidence/link",
        "http://localhost:8080/search/hybrid"
      ],
      "constants": {
        "min_q_score_threshold": 0.92,
        "max_drift_allowed": 0.015,
        "new_text_bytes_trigger": 1572864
      }
    },
    "safety_guards": [
      {
        "rule": "enforce_identity_lock",
        "max_limit": 1,
        "action_on_breach": "abort_call"
      },
      {
        "rule": "enforce_q_score",
        "max_limit": 0.92,
        "action_on_breach": "regenerate"
      }
    ]
  },
  {
    "id": "svc-ai-audit-001",
    "type": "strategy",
    "human_title": "AI-Agent Reliability Audit — за 72 часа делаю ваших агентов безопасными",
    "agent_summary": "AI-Agent Reliability Audit service. Problem: production AI agents hallucinate, get prompt-injected, no rollback. Gartner: 40% will disable autonomous agents by 2027. Deliverable: agent capability/permission map, injection stress-test, Decision Trace logging, instant Rollback module, safety policy. Tiered pricing: free diagnostic call -> $500-1500 mini-audit -> $3-5k full 72h -> $12500 enterprise. Built on proven components: Acceptor Loop (decision trace), anti-self veto (rollback gate), HOT-3 Belief Dominance (uncertainty measurement), sovereign local architecture (no data leak).",
    "tags": [
      "security",
      "ai",
      "agent",
      "reliability",
      "audit"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {
        "diagnostic_price_usd": 0,
        "mini_audit_usd": 1000,
        "full_audit_usd": 4000,
        "enterprise_usd": 12500,
        "audit_hours": 72
      }
    },
    "safety_guards": [
      {
        "rule": "rollback_module_required",
        "max_limit": 1,
        "action_on_breach": "block_deploy"
      }
    ]
  },
  {
    "id": "mem-sbor-ai-agent-trust-layer-rel",
    "type": "strategy",
    "human_title": "AI-Agent Trust Layer: надёжность агентов как продукт",
    "agent_summary": "Trust Layer между LLM и средой: threat model агентов = чек-лист аудита надёжности.",
    "tags": [
      "ai",
      "ai",
      "agent",
      "trust",
      "layer",
      "reliability"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  },
  {
    "id": "mem-sbor-multiagent-orchestration",
    "type": "strategy",
    "human_title": "Мультиагентная оркестрация и автономное исследование",
    "agent_summary": "Граф-оркестрация, test-time compute, Arbiter/Clarifier; арена как автономная исследовательская система.",
    "tags": [
      "ai",
      "multiagent",
      "orchestration",
      "autonomous",
      "research"
    ],
    "params": {
      "contracts": [],
      "rpc_endpoints": [],
      "constants": {}
    },
    "safety_guards": []
  }
];

	return new Response(JSON.stringify(guides), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	});
}
