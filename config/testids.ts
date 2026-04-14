export const testIds = {
  global: {
    appLoading: "global-loading",
    modalBackdrop: "modal-backdrop",
    modalContainer: "modal-container",
    skeleton: "global-skeleton",
    unsavedDialogConfirm: "unsaved-dialog-confirm",
    unsavedDialogCancel: "unsaved-dialog-cancel"
  },
  auth: {
    signInEmail: "auth-signin-email-input",
    signInPassword: "auth-signin-password-input",
    signInSubmit: "auth-signin-submit",
    signUpEmail: "auth-signup-email-input",
    signUpPassword: "auth-signup-password-input",
    signUpSubmit: "auth-signup-submit",
    resetEmail: "auth-reset-email-input",
    resetSubmit: "auth-reset-submit"
  },
  tournaments: {
    landingJoinCta: "tournament-join-cta",
    leaderboardJoinCta: "leaderboard-join-cta",
    tournamentCardJoin: "tournament-card-join",
    tournamentRow: "tournament-row",
    picksTeamToggle: "picks-team-toggle",
    picksSaveButton: "picks-save-button",
    picksSaveSuccess: "picks-save-success"
  },
  leaderboard: {
    table: "leaderboard-table",
    row: "leaderboard-row",
    rankCell: "leaderboard-rank",
    scoreCell: "leaderboard-score",
    usernameCell: "leaderboard-username"
  },
  account: {
    teamNameInput: "account-team-name-input",
    backgroundColorInput: "account-background-color-input",
    saveButton: "account-save-button",
    saveSuccess: "account-save-success"
  }
} as const;

export type TestIdMap = typeof testIds;
