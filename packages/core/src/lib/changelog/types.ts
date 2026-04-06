import { ChangeType, Config } from "../config";
import { Logger, defaultLogger } from "../logger";
import { Module } from "../project/types";
import { Version } from "../version";

export type Commit = {
  oid: string;
  message: string;
  author?: {
    name?: string;
    user?: { login?: string; url?: string } | null;
  } | null;
  associatedPullRequests: {
    nodes: Array<{ number: number; repository: { nameWithOwner: string } }>;
  };
};

export type PR = {
  number: number;
  title: string;
  body: string;
  author: { login: string; url: string };
  labels: { nodes: { name: string }[] };
  commits?: {
    nodes: Array<{
      commit: {
        messageHeadline?: string;
        messageBody?: string;
      };
    }>;
  };
};

export type Change = PR & {
  type: ChangeType;
  pkgs: string[];
  sourceCommit?: string;
  isRefinement?: boolean;
};

export type GitHubClient = {
  setup(): void;
  isOwner(input: { nameWithOwner: string }): boolean;
  batch<O>(
    queryBuilder: (_: string | number) => string,
  ): (items: Array<string | number>) => Promise<O[]>;
  issue(n: number): string;
  release(
    version: Version,
    body: string,
  ): Promise<{ data: { number: number; html_url: string } }>;
};

export class Api {
  constructor(
    public config: Config,
    public github: GitHubClient,
    public module: Module,
    public logger: Logger = defaultLogger,
  ) {}
}
