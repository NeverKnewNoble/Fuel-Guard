import { redirect } from "next/navigation";

import { SessionService } from "@/services/sessionService";
import { homeFor, LOGIN_PATH } from "@/utils/authRoutes";

/**
 * Opening the software goes straight to sign-in, at the client's request — signed in already, it
 * goes to that role's home instead, so nobody sees a login form they don't need.
 *
 * The marketing landing page it used to show is still in `src/components/home/` (Hero, Features,
 * Footer). To bring it back, restore the version below.
 *
 *   import Features from "@/components/home/features";
 *   import Footer from "@/components/home/footer";
 *   import Hero from "@/components/home/hero";
 *
 *   export default function Home() {
 *     return (
 *       <div className="flex flex-1 flex-col bg-neutral-950 font-sans">
 *         <Hero />
 *         <main className="flex-1"><Features /></main>
 *         <Footer />
 *       </div>
 *     );
 *   }
 */
export default async function Home() {
  const actor = await SessionService.getActor();
  redirect(actor ? homeFor(actor.role) : LOGIN_PATH);
}
