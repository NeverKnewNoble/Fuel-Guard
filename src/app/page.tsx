import Features from "@/components/home/features";
import Footer from "@/components/home/footer";
import Hero from "@/components/home/hero";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-neutral-950 font-sans">
      <Hero />
      <main className="flex-1">
        <Features />
      </main>
      <Footer />
    </div>
  );
}
