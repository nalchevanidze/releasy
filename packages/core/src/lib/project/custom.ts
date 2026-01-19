import { CustomManager, Manager } from "../config";
import { exec, execVoid } from "../utils";
import { Module, VersionChangeType } from "./types";

export class CustomModule implements Module {
  constructor(private config: CustomManager) {}

  public version = () => exec(this.config.version);

  public next = async (option: VersionChangeType) => {
    const { next } = this.config;
    return execVoid(option ? `${next} ${option}` : next);
  };

  public setup = async () => {
    await execVoid(this.config.setup);
  };

  public pkg = (id: string): string => this.config.pkg.replace("{{PKG}}", id);
}
