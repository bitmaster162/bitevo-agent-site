#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.mjs';

void serveStdio(() => createServer());
console.error('bitevo-authority MCP server running on stdio');
