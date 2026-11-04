<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All backend calls go through src/lib/api.ts (typed; DEMO mock when VITE_API_URL unset) — one place to fix contract mismatches.
- Features live in src/features/{auth,chat,billing}; theme tokens in src/styles/tokens.css — keeps screens thin and theming swappable.
- Every useEffect/useLayoutEffect is a block body that returns nothing or a named function — never an expression. A returned non-function (e.g. a Promise) gets invoked as React's effect cleanup in dev and blanked the preview twice ("n is not a function" / "destroy is not a function").
