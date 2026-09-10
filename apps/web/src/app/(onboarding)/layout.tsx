import { OnboardingChrome } from "@/components/companion/onboarding-chrome";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingChrome>{children}</OnboardingChrome>;
}
