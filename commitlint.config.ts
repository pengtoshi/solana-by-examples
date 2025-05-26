const typeEnum = ["Feat", "Fix", "Chore", "Test", "Deploy", "Refactor"];

const Configuration = {
  extends: ["git-commit-emoji"],
  rules: {
    //* Type
    "type-empty": [2, "never"],

    //* Scope
    "scope-case": [2, "never", []],
    "scope-empty": [0],
    "scope-enum": [2, "always", []],

    //* Subject
    "subject-full-stop": [2, "never", "."],
    "subject-exclamation-mark": [2, "never", "!"],
    "subject-case": [2, "never", []],
    "subject-empty": [2, "never"],

    //* Body & Footer
    "body-leading-blank": [1, "always"],
    "body-max-line-length": [2, "always", 100],
    "footer-leading-blank": [1, "always"],
    "footer-max-line-length": [2, "always", 100],
  },

  prompt: {},
  ignores: [
    (message: string) =>
      message.startsWith("Merge") ||
      message.startsWith("Revert") ||
      message.startsWith("Amend") ||
      message.startsWith("Reset") ||
      message.startsWith("Rebase") ||
      message.startsWith("Tag"),
  ],
  parserPreset: {
    parserOpts: {
      headerPattern:
        /^(?:\S+\s+)?(\S+)(?:\(([^\)]+)\))?: (.+)(?:\s+\(#\d+\))?$/,
      headerCorrespondence: ["type", "scope", "subject"],
    },
  },
  plugins: [
    {
      rules: {
        "custom-type-enum": (parsed, _when, value) => {
          const { type } = parsed;
          const strippedType = type.replace(/^[^\w]+/, "");
          if (!value.includes(strippedType)) {
            return [false, `type must be one of [${value.join(", ")}]`];
          }
          return [true];
        },
        "custom-type-case": (parsed, _when, value) => {
          const { type } = parsed;
          const strippedType = type.replace(/^[^\w]+/, "");
          if (value === "pascal-case" && !/^[A-Z][a-z]+$/.test(strippedType)) {
            return [false, `type must be pascal-case`];
          }
          return [true];
        },
      },
    },
  ],
};

Configuration.rules["type-enum"] = [2, "always", typeEnum];
Configuration.rules["type-case"] = [2, "always", "pascal-case"];

module.exports = Configuration;
