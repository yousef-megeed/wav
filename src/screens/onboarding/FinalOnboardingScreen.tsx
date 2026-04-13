import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type FinalOnboardingScreenProps = {
  onSkip?: () => void;
  onGetStarted?: () => void;
};

const palette = {
  background: "#0e0e0e",
  surfaceContainerHigh: "#201f1f",
  surfaceContainerHighest: "#262626",
  onSurface: "#ffffff",
  onSurfaceVariant: "#adaaaa",
  primary: "#ba9eff",
  primaryDim: "#8455ef",
  onPrimary: "#39008c",
  secondaryContainer: "#5e2c91",
};

const HERO_IMAGE_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDmZDvaE0nxfzkvkQ005BhC4Hku_15GIwaxE_YZ6__ASVZg2muCEXiHqYf82CPaLRwVyoFLK3xV04_mEcmUHO5D6Z35fm3oLMpAgkI4PudQLBlDjOWA6vn8pFlRH8AjjDn75mU6Tsnr2JTNZTP2xPyq_6aPUD-BCHqtavJuXnrF_U47bOA4ixAge2DkVpW1RZi0E2A1OuczolwAXc1qU-eVZ2WjLGbb5CnISWku-pZ3C4RZ4YE72BYZCGBdm-va2-eM3Kryd6OdyagY";

export function FinalOnboardingScreen({
  onSkip,
  onGetStarted,
}: FinalOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.atmoRight} />
      <View pointerEvents="none" style={styles.atmoLeft} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandWrap}>
            <MaterialIcons name="blur-on" size={24} color={palette.primary} />
            <Text style={styles.brandText}>WAV</Text>
          </View>

          <Pressable onPress={onSkip} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.heroContent}>
          <View style={styles.heroImageWrap}>
            <Image source={{ uri: HERO_IMAGE_URI }} style={styles.heroImage} />
            <LinearGradient
              colors={["rgba(14,14,14,0.85)", "rgba(14,14,14,0)", "rgba(14,14,14,0.75)"]}
              locations={[0, 0.35, 1]}
              style={styles.heroOverlay}
            />

            <View style={styles.heroMetaRow}>
              <View>
                <Text style={styles.heroMetaLabel}>Featured Space</Text>
                <Text style={styles.heroMetaText}>Obsidian Sound Lab, Berlin</Text>
              </View>
              <View style={styles.heroChip}>
                <MaterialIcons name="graphic-eq" size={14} color={palette.primary} />
                <Text style={styles.heroChipText}>96kHz Audio</Text>
              </View>
            </View>
          </View>

          <View style={styles.copyWrap}>
            <Text style={styles.title}>
              Resonate with your <Text style={styles.titleAccent}>next</Text> collaborator.
            </Text>
            <Text style={styles.subtitle}>
              The premium network for high-fidelity music production. Connect with world-class engineers,
              producers, and session musicians in a noise-free environment.
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={["rgba(14,14,14,0)", "rgba(14,14,14,0.95)", "rgba(14,14,14,1)"]}
          locations={[0, 0.45, 1]}
          style={styles.footer}
        >
          <View style={styles.footerInner}>
            <View style={styles.progressWrap}>
              <View style={styles.progressBars}>
                <View style={styles.progressActive} />
                <View style={styles.progressInactive} />
                <View style={styles.progressInactive} />
                <View style={styles.progressInactive} />
              </View>
              <Text style={styles.progressText}>Progress: 1 of 4</Text>
            </View>

            <Pressable onPress={onGetStarted} style={({ pressed }) => [styles.ctaOuter, pressed && styles.pressed]}>
              <LinearGradient
                colors={[palette.primary, palette.primaryDim]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaButton}
              >
                <Text style={styles.ctaText}>Get Started</Text>
                <MaterialIcons name="arrow-forward" size={18} color={palette.onPrimary} />
              </LinearGradient>
            </Pressable>

            <Text style={styles.footerCopy}>Designed for Professionals. Built for Sound.</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loaderWrap: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    minHeight: 56,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandText: {
    color: palette.primary,
    fontSize: 24,
    letterSpacing: -0.8,
    fontFamily: "Inter_800ExtraBold",
  },
  skipButton: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  skipText: {
    color: palette.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  main: {
    display: "none",
  },
  atmoRight: {
    position: "absolute",
    top: "24%",
    right: -80,
    width: 380,
    height: 380,
    borderRadius: 999,
    backgroundColor: "rgba(186,158,255,0.1)",
  },
  atmoLeft: {
    position: "absolute",
    bottom: -80,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(94,44,145,0.1)",
  },
  heroContent: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    gap: 24,
  },
  heroImageWrap: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: palette.surfaceContainerHigh,
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 24 },
    elevation: 10,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMetaRow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroMetaLabel: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontFamily: "Inter_700Bold",
  },
  heroMetaText: {
    marginTop: 2,
    color: palette.onSurface,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(19,19,19,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroChipText: {
    color: palette.onSurface,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_600SemiBold",
  },
  copyWrap: {
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  title: {
    color: palette.onSurface,
    textAlign: "center",
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 14,
  },
  titleAccent: {
    color: palette.primary,
    fontStyle: "italic",
  },
  subtitle: {
    color: palette.onSurfaceVariant,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    marginTop: "auto",
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  footerInner: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    alignItems: "center",
    gap: 14,
  },
  progressWrap: {
    alignItems: "center",
    gap: 8,
  },
  progressBars: {
    flexDirection: "row",
    gap: 8,
  },
  progressActive: {
    width: 32,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  progressInactive: {
    width: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.surfaceContainerHighest,
  },
  progressText: {
    color: palette.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  ctaOuter: {
    width: "100%",
    borderRadius: 999,
    shadowColor: palette.primary,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  ctaButton: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    color: palette.onPrimary,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "Inter_800ExtraBold",
  },
  footerCopy: {
    color: "rgba(173,170,170,0.5)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.985 }],
  },
});
