import { ChangeType, LabelType } from "../config";

type BaseLabel = {
  name: string;
  color: string; // hex without #
  description?: string;
  existing?: string;
};

export type PkgLabel = BaseLabel & {
  type: "pkgs";
  pkg: string;
};

export type ChangeTypeLabel = BaseLabel & {
  type: "changeTypes";
  changeType: ChangeType;
};

export type Label = ChangeTypeLabel | PkgLabel;
