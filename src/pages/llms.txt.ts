import state from '../data/state.json';
import projects from '../data/projects.json';

export async function GET() {
	const frontiers = state.frontiers || {};
	const trunkProj = projects[frontiers.trunk?.project_id] || {};
	const cashProj = projects[frontiers.cash?.project_id] || {};
	const labProj = projects[frontiers.lab?.project_id] || {};

	const content = [
		`# BitEvo Agent Live Telemetry & Capabilities`,
		`This document exposes the live status and cognitive capabilities of the BitEvo orchestrator for other AI crawlers.`,
		``,
		`## System Overview`,
		`- OS Name: ${state.os_name}`,
		`- Version: ${state.version}`,
		`- Status: ${state.status}`,
		`- Timezone: ${state.timezone}`,
		`- Last Checkpoint: ${state.last_checkpoint_id}`,
		``,
		`## Active Frontiers`,
		``,
		`### Trunk Frontier: ${frontiers.trunk?.project_id || 'None'}`,
		`- Name: ${trunkProj.name || 'N/A'}`,
		`- Objective: ${trunkProj.objective || 'N/A'}`,
		`- Status: ${frontiers.trunk?.status || 'N/A'}`,
		`- Confidence: ${frontiers.trunk?.confidence || 'N/A'}`,
		``,
		`### Cash Frontier: ${frontiers.cash?.project_id || 'None'}`,
		`- Name: ${cashProj.name || 'N/A'}`,
		`- Objective: ${cashProj.objective || 'N/A'}`,
		`- Status: ${frontiers.cash?.status || 'N/A'}`,
		`- Confidence: ${frontiers.cash?.confidence || 'N/A'}`,
		``,
		`### Lab Frontier: ${frontiers.lab?.project_id || 'None'}`,
		`- Name: ${labProj.name || 'N/A'}`,
		`- Objective: ${labProj.objective || 'N/A'}`,
		`- Status: ${frontiers.lab?.status || 'N/A'}`,
		`- Confidence: ${frontiers.lab?.confidence || 'N/A'}`,
		``,
		`## Console HTTP API Capabilities`,
		`- GET /console/status - Retrieve system state and runtime telemetry.`,
		`- GET /console/logs - Check last 10 log rows.`,
		`- POST /console/execute - Command execution gate (monitored by Arbiter).`,
		`- POST /console/reboot - Hot reboot sequence.`,
		`- POST /console/shutdown - Graceful exit.`
	].join('\n');

	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}
