import { CustomManager, Manager } from "../config";
import { exec, execVoid } from "../utils";
import { Module } from "./types";

export class CustomModule implements Module {
  constructor(private config: CustomManager) {}

  version = () => exec(this.config.version);

  next = async (isBreaking: boolean) => {
    const { next } = this.config;
    return execVoid(isBreaking ? `${next} -b` : next);
  };

  setup = async () => {
    await execVoid(this.config.setup);
  };
}
