import { CustomManager, Manager } from "../config";
import { exec, execVoid } from "../utils";
import { Module, VersionChangeType } from "./types";

export class CustomModule implements Module {
  constructor(private config: CustomManager) {}

  version = () => exec(this.config.version);

  next = async (option: VersionChangeType) => {
    const { next } = this.config;
    return execVoid(option ? `${next} ${option}` : next);
  };

  setup = async () => {
    await execVoid(this.config.setup);
  };

  pkg(id: string): string {
    return this.config.pkg.replace("{{PKG}}", id);
  }
}
