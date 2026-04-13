// Renders onboarding content and routes users to authentication.
import { Button } from "@/src/components/common/Button";
import { Screen } from "@/src/components/common/Screen";
import { TitleBlock } from "@/src/components/common/TitleBlock";
import { useOnboardingProgress } from "@/src/hooks";
import type { RootStackWithAuthParamList } from "@/src/navigation";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";

export const OnboardingScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackWithAuthParamList>>();
  const { reset } = useOnboardingProgress();

  return (
    <Screen>
      <View style={styles.container}>
        <TitleBlock
          title="Profile-first onboarding"
          subtitle="Build your creative identity in 5 quick steps with mostly tap-to-select choices."
        />
        <Button
          label="Start Onboarding"
          variant="primary"
          onPress={() => {
            reset();
            navigation.navigate("ProfileCreation");
          }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
});
