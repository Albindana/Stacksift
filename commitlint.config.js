module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci', 'perf', 'build', 'revert']],
    'subject-case': [0],
  },
};
