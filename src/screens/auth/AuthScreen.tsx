import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_COLORS } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

const HERO_IMAGE_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAyJs4skcSefr9_AGChwkQ1lUYgzkWI9br1KnacRU7OT2jVH2xyZOrU3nKZ6yQJpntJYdXvP_4zfNKDX_DCTbD0fj64iCufh1Oy4wlbRc0aUbuxskvuAbka59uAyje22GLpYVorBYXoa9UoVlM8S2WVzqzbraqMBUJcQMHACmEnAo3M1_PqNPaGOzvbbmRB2CsH5yoDvFgLl28-b7cV3Ak9YHdb-DO7i_-D4XbUi53m1LyXDGKRBNNYCLYVhueLfVeClnY4jUmp0PJq";

const palette = {
  background: APP_COLORS.background,
  surfaceHigh: APP_COLORS.surfaceHigher,
  surfaceHighest: APP_COLORS.surfaceHighest,
  outline: APP_COLORS.outline,
  text: APP_COLORS.textPrimary,
  muted: APP_COLORS.textSecondary,
  primary: APP_COLORS.primary,
  primaryDim: APP_COLORS.primaryDim,
  success: APP_COLORS.success,
  error: APP_COLORS.error,
};

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated?: (session: Session) => void;
}) {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_900Black,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({
    type: "idle",
    message: "",
  });

  const isSuccess = status.type === "success";

  const statusColor = useMemo(() => {
    if (status.type === "success") return palette.success;
    if (status.type === "error") return palette.error;
    return palette.muted;
  }, [status.type]);

  const handleSignUp = async () => {
    if (!email || !password) {
      setStatus({
        type: "error",
        message: "Enter email and password first.",
      });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "idle", message: "" });

    const { data, error } = await supabase.auth.signUp({ email, password });

    setIsLoading(false);

    if (error) {
      console.error("Sign Up error:", error.message);
      setStatus({ type: "error", message: `Sign Up failed: ${error.message}` });
      return;
    }

    console.log("Sign Up success:", data);
    setStatus({
      type: "success",
      message: "Account created. Check your inbox if verification is enabled.",
    });

    if (data.session && onAuthenticated) {
      onAuthenticated(data.session);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setStatus({
        type: "error",
        message: "Enter email and password first.",
      });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "idle", message: "" });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      console.error("Sign In error:", error.message);
      setStatus({ type: "error", message: `Sign In failed: ${error.message}` });
      return;
    }

    console.log("Sign In success:", data);
    setStatus({ type: "success", message: "Signed in successfully." });
    if (data.session && onAuthenticated) {
      onAuthenticated(data.session);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setStatus({ type: "idle", message: "" });

    const redirectTo = ExpoLinking.createURL("auth/callback");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setIsLoading(false);
      console.error("Google Sign In error:", error.message);
      setStatus({
        type: "error",
        message: `Google Sign In failed: ${error.message}`,
      });
      return;
    }

    console.log("Google Sign In success:", data);

    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");

        if (code) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            setIsLoading(false);
            setStatus({
              type: "error",
              message: `Google callback failed: ${exchangeError.message}`,
            });
            return;
          }

          if (exchangeData.session && onAuthenticated) {
            onAuthenticated(exchangeData.session);
          }

          setIsLoading(false);
          setStatus({
            type: "success",
            message: "Google sign-in completed.",
          });
          return;
        }
      }

      setIsLoading(false);
      setStatus({
        type: "success",
        message: "Google sign-in opened. Complete it in your browser.",
      });
      return;
    }

    setIsLoading(false);
    setStatus({ type: "success", message: "Google auth launched." });
  };

  const handleAppleSignIn = () => {
    setStatus({
      type: "error",
      message: "Apple Sign In not wired yet.",
    });
  };

  const handleBack = () => {
    setEmail("");
    setPassword("");
    setStatus({ type: "idle", message: "" });
  };

  const handleOpenTerms = async () => {
    const url = "https://example.com/terms";
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Unable to open", "Could not open Terms of Service.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleOpenPrivacy = async () => {
    const url = "https://example.com/privacy";
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Unable to open", "Could not open Privacy Policy.");
      return;
    }
    await Linking.openURL(url);
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundLayer}>
        <ImageBackground
          source={require("../../../assets/figma/noise.png")}
          style={StyleSheet.absoluteFill}
          imageStyle={styles.noise}
        />
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />
      </View>

      <View style={styles.topNav}>
        <Pressable style={styles.iconButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={20} color={palette.primary} />
        </Pressable>
        <Text style={styles.navTitle}>WAV</Text>
        <View style={styles.profileBubble}>
          <MaterialIcons name="person" size={16} color={palette.muted} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandWrap}>
          <Text style={styles.logo}>WAV</Text>
          <LinearGradient
            colors={[palette.primary, palette.primaryDim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoUnderline}
          />
          <Text style={styles.tagline}>Resonate with the Rhythm</Text>
        </View>

        <View style={styles.heroWrap}>
          <Image source={{ uri: HERO_IMAGE_URI }} style={styles.heroImage} />
          <LinearGradient
            colors={["transparent", palette.background]}
            style={styles.heroFade}
          />
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>Live Session</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#6f6c6c"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#6f6c6c"
            style={styles.input}
          />
        </View>

        <View style={styles.authActions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handleSignUp()}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[palette.primary, palette.primaryDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonFill}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handleSignIn()}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Continue With</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => void handleGoogleSignIn()}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={16} color={palette.text} />
              <Text style={styles.socialButtonText}>Google</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={18} color={palette.text} />
              <Text style={styles.socialButtonText}>Apple</Text>
            </Pressable>
          </View>

          {status.message ? (
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.message}
            </Text>
          ) : null}

          {isLoading ? (
            <ActivityIndicator
              style={styles.loadingSpinner}
              color={palette.primary}
            />
          ) : null}
        </View>

        <Text style={styles.legalText}>
          By continuing, you agree to WAV&apos;s{" "}
          <Text style={styles.legalLink} onPress={() => void handleOpenTerms()}>
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            style={styles.legalLink}
            onPress={() => void handleOpenPrivacy()}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>

      {isSuccess ? (
        <View pointerEvents="none" style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <MaterialIcons
                name="check-circle"
                size={34}
                color={palette.primary}
              />
            </View>
            <Text style={styles.successTitle}>Welcome Back</Text>
            <Text style={styles.successSubtitle}>
              Initializing your experience...
            </Text>
          </View>
        </View>
      ) : null}
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
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.background,
  },
  noise: {
    opacity: 0.05,
  },
  topGlow: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 180,
    backgroundColor: "rgba(186, 158, 255, 0.12)",
  },
  bottomGlow: {
    position: "absolute",
    right: -100,
    bottom: -100,
    width: 240,
    height: 240,
    borderRadius: 160,
    backgroundColor: "rgba(94, 44, 145, 0.14)",
  },
  topNav: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    color: palette.text,
    fontSize: 22,
    letterSpacing: -1.2,
    fontFamily: "Inter_900Black",
  },
  profileBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: palette.surfaceHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  brandWrap: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 40,
  },
  logo: {
    color: palette.text,
    fontSize: 74,
    letterSpacing: -3,
    fontFamily: "Inter_900Black",
    textShadowColor: "rgba(186, 158, 255, 0.45)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  logoUnderline: {
    width: 54,
    height: 4,
    borderRadius: 999,
    marginTop: -6,
    marginBottom: 12,
  },
  tagline: {
    color: palette.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2.4,
    fontFamily: "Inter_500Medium",
  },
  heroWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: palette.surfaceHigh,
    shadowColor: "#ba9eff",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  heroChip: {
    position: "absolute",
    left: 16,
    bottom: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroChipText: {
    color: palette.primary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  inputGroup: {
    gap: 10,
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(119, 117, 117, 0.45)",
    backgroundColor: "rgba(19, 19, 19, 0.9)",
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 18,
    fontFamily: "Inter_400Regular",
  },
  authActions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  primaryButtonFill: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#39008c",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(73, 72, 71, 1)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(73, 72, 71, 0.45)",
  },
  dividerText: {
    color: palette.muted,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginHorizontal: 10,
    fontFamily: "Inter_700Bold",
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(73, 72, 71, 0.35)",
    backgroundColor: "rgba(19, 19, 19, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  socialButtonText: {
    color: palette.text,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  statusText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_500Medium",
  },
  loadingSpinner: {
    marginTop: 6,
  },
  legalText: {
    marginTop: 24,
    textAlign: "center",
    color: "rgba(173, 170, 170, 0.72)",
    fontSize: 10,
    lineHeight: 16,
    paddingHorizontal: 24,
    fontFamily: "Inter_400Regular",
  },
  legalLink: {
    color: palette.text,
    textDecorationLine: "underline",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  successCard: {
    width: 270,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(32,31,31,0.9)",
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(186, 158, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    color: palette.text,
    fontSize: 21,
    marginBottom: 4,
    fontFamily: "Inter_700Bold",
  },
  successSubtitle: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
