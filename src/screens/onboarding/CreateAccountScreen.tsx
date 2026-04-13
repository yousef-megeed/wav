import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

type CreateAccountScreenProps = {
  onBack?: () => void;
  onNext?: () => void;
};

const palette = {
  background: "#0e0e0e",
  surfaceContainerLow: "#131313",
  surfaceContainerHigh: "#201f1f",
  surfaceContainerHighest: "#262626",
  onSurface: "#ffffff",
  onSurfaceVariant: "#adaaaa",
  primary: "#ba9eff",
  primaryDim: "#8455ef",
  onPrimary: "#39008c",
  outlineVariant: "#494847",
};

const GOOGLE_LOGO_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD8XZaU91Jf6wjxNcicPgX_WS5EOGrLhvxPnC9_3bWhoYaZkwf3IxodtcKzg0YXqI_CNssGPvNosZQzMclFe86puhvgMF8APljBeKYNKdVBcdLAmRnYtU1RGBYpnTUhMSZje4eviVKijbAmfIyPnPaeQQD1q6lD49DyH3KqYFawMVrX0XpJusaqrfunBXgQSlDSQ5DouP_bMf8fMJlxfEYHeNLnMxPmB22Qytntng3R2J1azp7NFo7xpCxCEQ5hS81CuudxK2ONdrFj";

export function CreateAccountScreen({ onBack, onNext }: CreateAccountScreenProps) {
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 4 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={palette.onSurface}
              />
            </Pressable>
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.progressRow}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.pill} />
          </View>

          <View style={styles.editorialWrap}>
            <Text style={styles.editorialTitle}>Final Step</Text>
            <Text style={styles.editorialSubtitle}>
              Review your artist profile details and secure your account to
              start collaborating.
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Summary of your choices</Text>
            <View style={styles.summaryChips}>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>Producer</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>Dark Pop</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>Berlin</Text>
              </View>
            </View>
          </View>

          <View style={styles.formWrap}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="name@email.com"
                placeholderTextColor="rgba(173,170,170,0.4)"
                style={styles.inputField}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="rgba(173,170,170,0.4)"
                  style={styles.passwordField}
                />
                <Pressable
                  onPress={() => setIsPasswordVisible((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    name={isPasswordVisible ? "visibility" : "visibility-off"}
                    size={20}
                    color={palette.onSurfaceVariant}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.submitWrap}>
              <Pressable
                onPress={onNext}
                style={({ pressed }) => [
                  styles.submitOuter,
                  pressed && styles.pressed,
                ]}
              >
                <LinearGradient
                  colors={[palette.primary, palette.primaryDim]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitText}>Create My Profile</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <View style={styles.socialWrap}>
            <View style={styles.separatorWrap}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>Or join with</Text>
            </View>

            <View style={styles.socialRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.pressed,
                ]}
              >
                <Image
                  source={{ uri: GOOGLE_LOGO_URI }}
                  style={styles.googleLogo}
                />
                <Text style={styles.socialText}>Google</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="phone-iphone"
                  size={20}
                  color={palette.onSurface}
                />
                <Text style={styles.socialText}>Apple</Text>
              </Pressable>
            </View>

            <Text style={styles.legalText}>
              By creating an account, you agree to our{"\n"}
              <Text style={styles.legalLink}>Terms of Service</Text>
              <Text> and </Text>
              <Text style={styles.legalLink}>Privacy Policy</Text>
              <Text>.</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      <View pointerEvents="none" style={styles.bottomGlow} />
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
    paddingHorizontal: 24,
    paddingBottom: 56,
  },
  frame: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: palette.onSurface,
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.4,
    paddingRight: 48,
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  progressRow: {
    marginTop: 6,
    marginBottom: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceContainerHighest,
  },
  pill: {
    width: 32,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  editorialWrap: {
    paddingTop: 8,
    marginBottom: 32,
  },
  editorialTitle: {
    color: palette.onSurface,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  editorialSubtitle: {
    color: palette.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  summaryCard: {
    marginBottom: 40,
    padding: 24,
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  summaryLabel: {
    color: palette.primary,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
    marginBottom: 14,
  },
  summaryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryChip: {
    height: 36,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceContainerHigh,
  },
  summaryChipText: {
    color: palette.onSurface,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  formWrap: {
    gap: 22,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: palette.onSurface,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  inputField: {
    height: 56,
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerHighest,
    color: palette.onSurface,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  passwordWrap: {
    position: "relative",
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerHighest,
  },
  passwordField: {
    height: 56,
    borderRadius: 12,
    color: palette.onSurface,
    paddingHorizontal: 16,
    paddingRight: 50,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  submitWrap: {
    paddingTop: 4,
  },
  submitOuter: {
    borderRadius: 999,
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 6,
  },
  submitButton: {
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: palette.onPrimary,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  socialWrap: {
    marginTop: 44,
    paddingBottom: 8,
  },
  separatorWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  separatorLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(73,72,71,0.3)",
  },
  separatorText: {
    paddingHorizontal: 14,
    backgroundColor: palette.background,
    color: palette.onSurfaceVariant,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    fontFamily: "Inter_500Medium",
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  socialText: {
    color: palette.onSurface,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  legalText: {
    marginTop: 26,
    textAlign: "center",
    color: palette.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  legalLink: {
    color: palette.primary,
    fontFamily: "Inter_500Medium",
  },
  bottomGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 999,
    bottom: -120,
    left: "50%",
    marginLeft: -150,
    backgroundColor: "rgba(186,158,255,0.06)",
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.985 }],
  },
});
