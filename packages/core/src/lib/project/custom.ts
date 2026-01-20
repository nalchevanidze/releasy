import { CustomManager } from "../config";
import { exec, execVoid } from "../utils";
import { Version } from "../version";
import { Module, BumpType } from "./types";

export class CustomModule implements Module {
  constructor(private config: CustomManager) {}

  public version = () => Version.parse(exec(this.config.version).trim());

  public bump = async (option: BumpType) => {
    return execVoid(this.config.bump.replace("{{BUMP}}", option));
  };

  public postBump = async () => {
    await execVoid(this.config.postBump);
  };

  public pkg = (id: string): string => this.config.pkg.replace("{{PKG}}", id);
}
