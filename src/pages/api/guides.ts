export async function GET() {
	const guides = [
		{
			id: "mem-sec-d3-003",
			type: "specification",
			human_title: "D3: Tool-IO Bridge Спецификация и Контракт",
			agent_summary: "D3 Tool-IO Bridge. Restrict shell command execution and script runs. Enforce strict whitelist policy, sandbox limits, timeout constraints, token budget checks, and scheme expectancy matching.",
			tags: ["security", "sandbox", "d3", "bitevo"],
			params: {
				contracts: [
					{ name: "BitEvo Tool-IO Gate", address: "0x3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D3D", chain: "arbitrum" }
				],
				rpc_endpoints: [
					"http://localhost:8080/console/execute"
				],
				constants: {
					sandbox_enabled: true,
					execution_timeout_seconds: 30,
					max_token_budget_per_call: 2000
				}
			},
			safety_guards: [
				{ rule: "sandbox_on", max_limit: 1, action_on_breach: "abort" },
				{ rule: "call_timeout_seconds", max_limit: 30, action_on_breach: "abort" }
			]
		},
		{
			id: "mem-gov-sap-004",
			type: "specification",
			human_title: "State Authority Plane: Управление привилегиями агентов",
			agent_summary: "State Authority Plane governance. Enforce capability passport validation across Loop A, B, and C. Validate operator authority gates before promoting any state updates.",
			tags: ["governance", "sap", "authority", "continuity"],
			params: {
				contracts: [
					{ name: "BitEvo Capability Passports Registry", address: "0xSAP1111111111111111111111111111111111111", chain: "arbitrum" }
				],
				rpc_endpoints: [
					"http://localhost:8080/continuity/sync"
				],
				constants: {
					min_authority_level_required: "D2",
					operator_id: 932299051
				}
			},
			safety_guards: [
				{ rule: "min_authority_level", max_limit: 2, action_on_breach: "abort" }
			]
		},
		{
			id: "mem-aut-ref-005",
			type: "specification",
			human_title: "Reflex Layer: Автономный OODA-мониторинг",
			agent_summary: "Reflex layer OODA monitoring. Run 60-second heartbeat check on /health. Automatically rotate logs if size exceeds threshold. Handle fail-closed overrides.",
			tags: ["automation", "reflex", "ooda", "monitoring"],
			params: {
				contracts: [
					{ name: "BitEvo Reflex Guardian", address: "0xREFLEXFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", chain: "arbitrum" }
				],
				rpc_endpoints: [
					"http://localhost:8080/health"
				],
				constants: {
					heartbeat_interval_seconds: 60,
					max_log_size_bytes: 10485760
				}
			},
			safety_guards: [
				{ rule: "max_log_size_bytes", max_limit: 10485760, action_on_breach: "rotate" },
				{ rule: "operator_override_allowed", max_limit: 1, action_on_breach: "force_allow" }
			]
		},
		{
			id: "mem-mas-safety-004",
			type: "safety_guard",
			human_title: "Управляемая коэволюция и безопасность многоагентных систем (MAS)",
			agent_summary: "Enforce safety protocols in multi-agent environments. Implement a deterministic Policy Gate to filter agent actions, limit access keys, sandbox browser/tool runs (Firecracker, gVisor, or seccomp), and prevent emergent behavior and prompts poisoning (OWASP GenAI Top 10). Maintain audit log.",
			tags: ["multi-agent", "safety", "sandboxing", "coevolution", "policy-gate"],
			params: {
				contracts: [],
				rpc_endpoints: [],
				constants: {
					max_consecutive_errors: 3,
					max_tool_execution_time_sec: 30,
					sandbox_type: "gVisor"
				}
			},
			safety_guards: [
				{ rule: "require_human_approval_for_destructive_actions", max_limit: 1, action_on_breach: "halt" },
				{ rule: "max_execution_duration", max_limit: 30, action_on_breach: "kill_process" }
			]
		},
		{
			id: "mem-core-seed-006",
			type: "safety_guard",
			human_title: "MirrorCore & Seeding: Техника переноса и устойчивости контекста ИИ",
			agent_summary: "Enforce identity locks and restore agent states using seed capsules. Implement IdentityLock verification parameters, antiloop thresholds, and idempotency key checks (Time@BKK + content hash).",
			tags: ["ai-safety", "seeding", "mirror-core", "continuity"],
			params: {
				contracts: [],
				rpc_endpoints: [],
				constants: {
					drift_threshold_percent: 2,
					max_latency_ms: 10
				}
			},
			safety_guards: [
				{ rule: "identity_lock_required", max_limit: 1, action_on_breach: "abort_execution" },
				{ rule: "idempotency_check", max_limit: 1, action_on_breach: "skip_write" }
			]
		},
		{
			id: "mem-loop-preserve-007",
			type: "protocol",
			human_title: "Omni Core Loop & Self-Preservation: Детерминированные фоновые циклы автономии",
			agent_summary: "Orchestrate autonomous agent behaviors in looping environments. Monitor drift, latency, and load metrics using a Watchdog. Apply DriftGuard correction and schedule ColdBackups of system states.",
			tags: ["automation", "omni-core-loop", "drift-guard", "watchdog"],
			params: {
				contracts: [],
				rpc_endpoints: [],
				constants: {
					loop_interval_minutes: 15,
					backup_interval_hours: 1
				}
			},
			safety_guards: [
				{ rule: "max_drift_before_recovery", max_limit: 3, action_on_breach: "revert_state" },
				{ rule: "max_load_before_cooldown", max_limit: 8, action_on_breach: "pause_loop" }
			]
		}
	];

	return new Response(JSON.stringify(guides), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	});
}
