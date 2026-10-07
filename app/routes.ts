import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("app/:id", "routes/app.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
