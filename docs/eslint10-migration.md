# ESLint 10 migration review

Draft, not ready to merge. ESLint 10.13.0 and @eslint-react 5.28.8 install with ordinary npm ci, without force, peer overrides, or legacy-peer-deps. React hooks 7.1.1 supports ESLint 10. Rules-of-hooks and exhaustive-deps keep their previous severities; the broader new compiler preset is not silently enabled.

TypeScript changes from 7.0.2 to 6.0.3 because the replacement's typescript-eslint parser requires >=4.8.4 <6.1.0. TypeScript 7 produces a ts-api-utils runtime crash. This is an explicit tooling compatibility tradeoff, not a claim that 7 works.

## Rule mapping

- display-name -> no-missing-component-display-name (different detection, review needed).
- jsx-key -> no-missing-key (different detection, review needed).
- jsx-no-comment-textnodes -> jsx-no-comment-textnodes.
- jsx-no-undef and jsx-uses-vars -> ESLint 10 native JSX reference tracking / no-undef and no-unused-vars.
- no-children-prop -> jsx-no-children-prop.
- no-danger-with-children -> dom-no-dangerously-set-innerhtml-with-children.
- no-direct-mutation-state -> no-direct-mutation-state.
- no-find-dom-node -> dom-no-find-dom-node.
- no-render-return-value -> dom-no-render-return-value.
- no-unknown-property -> dom-no-unknown-property.
- no-deprecated -> explicit no-component-will-mount / receive-props / update. This is NOT full parity with every old deprecated API check.
- Hooks rules retain their names and severities with the supported plugin.
- Fast refresh retains its rule and warning severity. The newer plugin adds one warning in src/main.jsx, making eight total instead of seven.

## Unresolved coverage, must not silently disappear

The old enabled jsx-no-duplicate-props, no-is-mounted, no-string-refs, no-unescaped-entities and require-render-return rules have no direct enabled replacement here. A duplicate JSX prop and unescaped apostrophe fixture both currently go unreported. Old no-deprecated also covers more than the enabled lifecycle replacements. Complete these checks with reviewed supported rules or explicitly approve the behavior change before marking ready.

Already-disabled prop-types, jsx-no-target-blank, react-in-jsx-scope and jsx-uses-react are not missing checks.

## Validation

Ordinary clean npm ci, typecheck, 249 app tests and production build pass locally on Node 22. Lint reports zero errors and eight warnings. scripts/test-eslint-migration.mjs proves seven representative retained checks actually fire. It does not prove full semantic parity. Native desktop packaging remains unverified for this draft.
