import { readFile } from 'node:fs/promises';

interface RawRedisEndpoint {
  username?: string;
  password?: string;
  tls: boolean;
  endpoints: string[];
}

export type RedisEndpointsConfig = Record<string, RawRedisEndpoint>;

export function loadFromJson(jsonString: string): RedisEndpointsConfig {
  try {
    return JSON.parse(jsonString) as RedisEndpointsConfig;
  } catch (error) {
    throw new Error(`Invalid JSON configuration: ${error}`);
  }
}

export async function loadFromFile(path: string): Promise<RedisEndpointsConfig> {
  try {
    const configFile = await readFile(path, 'utf-8');
    return loadFromJson(configFile);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Config file not found at path: ${path}`);
    }
    throw error;
  }
}