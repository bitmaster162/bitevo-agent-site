import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { buildDiagnostic } from './diagnostic.mjs';
import { buildHypothesis } from './hypothesis-builder.mjs';
import { callPreCheck } from './pre-check.mjs';

export const SERVER_NAME = 'bitevo-authority';
export const SERVER_VERSION = '0.1.0';

const answer = z.enum(['YES','NO','UNKNOWN']);
const answersShape = {
  action:answer,
  object:answer,
  owner:answer,
  evidence:answer,
  freshness:answer,
  confirm:answer,
  recovery:answer
};

function result(value, isError = false) {
  return {
    content:[{ type:'text', text:JSON.stringify(value,null,2) }],
    structuredContent:value,
    ...(isError ? { isError:true } : {})
  };
}

export function createServer() {
  const server = new McpServer({
    name:SERVER_NAME,
    title:'BitEvo Authority',
    version:SERVER_VERSION,
    websiteUrl:'https://bitevo.work'
  });

  server.registerTool(
    'diagnostic',
    {
      title:'BitEvo 7-gate diagnostic',
      description:'Evaluate one described workflow against BitEvo\'s seven authority/evidence gates using YES, NO or UNKNOWN. Returns unresolved decision gates; no trust score, certification or testing authorization.',
      inputSchema:z.object(answersShape).strict(),
      annotations:{ readOnlyHint:true, destructiveHint:false, openWorldHint:false, title:'BitEvo 7-gate diagnostic' }
    },
    async args => result(buildDiagnostic(args))
  );

  server.registerTool(
    'hypothesis_builder',
    {
      title:'BitEvo hypothesis builder',
      description:'Build the same local Entry Audit hypothesis draft used by bitevo.work from NO/UNKNOWN diagnostic gates. Produces scope text only and performs no test or external action.',
      inputSchema:z.object({ ...answersShape, locale:z.enum(['en','ru']).default('en') }).strict(),
      annotations:{ readOnlyHint:true, destructiveHint:false, openWorldHint:false, title:'BitEvo hypothesis builder' }
    },
    async ({ locale, ...answers }) => result(buildHypothesis(locale, answers))
  );

  server.registerTool(
    'pre_check',
    {
      title:'BitEvo Authority Pre-Check',
      description:'Send an agent/tool description to the canonical BitEvo Authority Pre-Check API. Local secret patterns are rejected before network I/O. The tool never calls OpenRouter directly and cannot bypass BitEvo API rate limits.',
      inputSchema:z.object({ text:z.string().min(1).max(8000), locale:z.enum(['en','ru']).default('en') }).strict(),
      annotations:{ readOnlyHint:true, destructiveHint:false, openWorldHint:true, title:'BitEvo Authority Pre-Check' }
    },
    async ({ text, locale }) => {
      const outcome = await callPreCheck(text, locale);
      return result(outcome, !outcome.ok);
    }
  );

  return server;
}
