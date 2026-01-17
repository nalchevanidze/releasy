import { ChangeType, LabelType } from "../config";

type BaseLabel = {
  name: string;
  color: string; // hex without #
  description?: string;
  existing?: string;
};

export type ScopeLabel = BaseLabel & {
  type: "scopes";
  scope: string;
};

export type ChangeTypeLabel = BaseLabel & {
  type: "changeTypes";
  changeType: ChangeType;
};

export type LABELS = {
  changeTypes: ChangeTypeLabel;
  scopes: ScopeLabel;
};

export type Label = ChangeTypeLabel | ScopeLabel;
