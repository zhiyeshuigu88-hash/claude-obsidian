export const MATERIALS = ["PLA", "PLA+", "PETG", "TPU", "ABS", "ASA", "その他"] as const;

export const DIAMETERS = [1.75, 2.85] as const;

export const FILAMENT_STATUS_LABEL: Record<string, string> = {
  unopened: "未開封",
  in_use: "使用中",
  used_up: "使用済み",
};

export const PRINT_RESULT_LABEL: Record<string, string> = {
  success: "成功",
  failure: "失敗",
  aborted: "途中中止",
};

export const PRINT_RESULT_OPTIONS = [
  { value: "success", label: "成功" },
  { value: "failure", label: "失敗" },
  { value: "aborted", label: "途中中止" },
] as const;
