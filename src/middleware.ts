import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jinja2|txt|xml|map|ico|png|svg|jpg|jpeg|gif|webp|avif|woff2?|ttf|eot)).*)',
    '/(api|trpc)(.*)',
  ],
};
