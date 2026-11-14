import * as YAML from 'yaml'
import * as z from 'zod'

/** Bundled as a standalone browser IIFE, once in each isolated realm. */
Object.assign(globalThis,{YAML,z})
