import { CustomManager } from "../config";
import { exec, execVoid } from "../utils";
import { Version } from "../version";
import { Module, BumpType } from "./types";

export class CustomModule implements Module {
  constructor(private config: CustomManager) {}

  public version = () => Version.parse(exec(this.config.version).trim());

  public bump = (option: BumpType) =>
    execVoid(this.config.bump.replace("{{BUMP}}", option));

  public postBump = async () =>
    this.config.postBump ? await execVoid(this.config.postBump) : undefined;

  public pkg = (id: string): string | undefined =>
    this.config.pkg ? this.config.pkg.replace("{{PKG}}", id) : undefined;
}
