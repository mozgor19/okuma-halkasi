# Project Rules

## Icons

- Use [Hugeicons Animated](https://hugeicons-animated.com/) for application icons whenever a matching animated icon exists.
- Install animated icons as source components with `npx shadcn@latest add @hugeicons-animated/<icon-name>` and expose them through `components/icons.tsx`.
- When the animated set has no semantically correct icon, use `@hugeicons/react` with `@hugeicons/core-free-icons` through `components/icons.tsx`.
- Do not add new `lucide-react` imports or introduce a second icon family.
- Preserve accessible labels and `prefers-reduced-motion` behavior for icon controls.
