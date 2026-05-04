import React from 'react';
import {
  Animated,
  AppState,
  Easing,
  I18nManager,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Surface, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { hasAllFilesAccess, openAllFilesAccessSettings } from '../../native/allFilesAccess';
import { useSettingsStore } from '../../store/settingsStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme/useAppTheme';
import { OnboardingPage } from './OnboardingPage';
import { getOnboardingPermissionVisualState } from './onboardingLogic';

const totalPages = 5;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type OnboardingPageConfig = {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  heroIcon: IconName;
  heroLabel: string;
  heroBadges: [string, string];
  highlights: { icon: IconName; label: string }[];
  statusPanel?: {
    icon: IconName;
    title: string;
    body: string;
    tone: 'info' | 'success' | 'warning';
  };
};

type OnboardingFlowProps = {
  onFinish?: () => void;
};

export function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const onboardingCompleted = useSettingsStore((state) => state.settings.onboardingCompleted);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const clearReplayRequest = useOnboardingStore((state) => state.clearReplayRequest);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [transitionDirection, setTransitionDirection] = React.useState<1 | -1>(1);
  const [accessGranted, setAccessGranted] = React.useState<boolean | undefined>();
  const [grantAttempted, setGrantAttempted] = React.useState(false);
  const transition = React.useRef(new Animated.Value(1)).current;
  const indicator = React.useRef(new Animated.Value(0)).current;

  const refreshAccess = React.useCallback(async () => {
    try {
      setAccessGranted(await hasAllFilesAccess());
    } catch {
      setAccessGranted(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshAccess();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAccess();
    });
    return () => subscription.remove();
  }, [refreshAccess]);

  const permissionState = getOnboardingPermissionVisualState({
    accessGranted,
    grantAttempted
  });

  const pages = React.useMemo<OnboardingPageConfig[]>(
    () => [
      {
        eyebrow: t('onboarding.welcome.eyebrow'),
        title: t('onboarding.welcome.title'),
        description: t('onboarding.welcome.body'),
        note: t('onboarding.welcome.note'),
        heroIcon: 'calendar-clock-outline' as const,
        heroLabel: t('onboarding.appName'),
        heroBadges: [t('onboarding.badges.originalDates'), t('onboarding.badges.onDevice')],
        highlights: [
          { icon: 'image-multiple-outline' as const, label: t('onboarding.welcome.highlightOne') },
          { icon: 'video-outline' as const, label: t('onboarding.welcome.highlightTwo') },
          { icon: 'folder-zip-outline' as const, label: t('onboarding.welcome.highlightThree') }
        ]
      },
      {
        eyebrow: t('onboarding.importZip.eyebrow'),
        title: t('onboarding.importZip.title'),
        description: t('onboarding.importZip.body'),
        note: t('onboarding.importZip.note'),
        heroIcon: 'folder-zip-outline' as const,
        heroLabel: t('onboarding.importZip.heroLabel'),
        heroBadges: [t('onboarding.badges.zipReady'), t('onboarding.badges.transcriptMatch')],
        highlights: [
          { icon: 'share-variant-outline' as const, label: t('onboarding.importZip.highlightOne') },
          { icon: 'file-document-outline' as const, label: t('onboarding.importZip.highlightTwo') },
          { icon: 'calendar-sync-outline' as const, label: t('onboarding.importZip.highlightThree') }
        ]
      },
      {
        eyebrow: t('onboarding.chooseSave.eyebrow'),
        title: t('onboarding.chooseSave.title'),
        description: t('onboarding.chooseSave.body'),
        note: t('onboarding.chooseSave.note'),
        heroIcon: 'tune-variant' as const,
        heroLabel: t('onboarding.chooseSave.heroLabel'),
        heroBadges: [t('onboarding.badges.flexibleFilters'), t('onboarding.badges.previewBeforeSave')],
        highlights: [
          { icon: 'account-outline' as const, label: t('onboarding.chooseSave.highlightOne') },
          { icon: 'filter-outline' as const, label: t('onboarding.chooseSave.highlightTwo') },
          { icon: 'image-check-outline' as const, label: t('onboarding.chooseSave.highlightThree') }
        ]
      },
      {
        eyebrow: t('onboarding.restoreDates.eyebrow'),
        title: t('onboarding.restoreDates.title'),
        description: t('onboarding.restoreDates.body'),
        note: t('onboarding.restoreDates.note'),
        heroIcon: 'calendar-check-outline' as const,
        heroLabel: t('onboarding.restoreDates.heroLabel'),
        heroBadges: [t('onboarding.badges.androidReady'), t('onboarding.badges.privateByDefault')],
        highlights: [
          { icon: 'calendar-range-outline' as const, label: t('onboarding.restoreDates.highlightOne') },
          { icon: 'content-save-check-outline' as const, label: t('onboarding.restoreDates.highlightTwo') },
          { icon: 'cellphone-lock' as const, label: t('onboarding.restoreDates.highlightThree') }
        ]
      },
      {
        eyebrow: t('onboarding.permission.eyebrow'),
        title: t('onboarding.permission.title'),
        description: t('onboarding.permission.body'),
        note: t('onboarding.permission.note'),
        heroIcon: permissionState === 'granted' ? 'shield-check-outline' : 'shield-key-outline',
        heroLabel: t('onboarding.permission.heroLabel'),
        heroBadges: [t('onboarding.badges.localOnly'), t('onboarding.badges.nothingUploaded')],
        highlights: [
          { icon: 'folder-zip-outline' as const, label: t('onboarding.permission.highlightOne') },
          { icon: 'content-save-check-outline' as const, label: t('onboarding.permission.highlightTwo') },
          { icon: 'cog-outline' as const, label: t('onboarding.permission.highlightThree') }
        ],
        statusPanel: getPermissionStatusPanel(t, permissionState)
      }
    ],
    [permissionState, t]
  );

  const currentPage = pages[pageIndex];

  const animatePage = React.useCallback(
    (nextIndex: number, direction: 1 | -1) => {
      setTransitionDirection(direction);
      setPageIndex(nextIndex);
      transition.setValue(0);
      Animated.parallel([
        Animated.timing(transition, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(indicator, {
          toValue: nextIndex,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false
        })
      ]).start();
    },
    [indicator, transition]
  );

  const completeOnboarding = React.useCallback(async () => {
    if (!onboardingCompleted) {
      await updateSettings({ onboardingCompleted: true });
    }
    clearReplayRequest();
    onFinish?.();
  }, [clearReplayRequest, onFinish, onboardingCompleted, updateSettings]);

  const goNext = React.useCallback(() => {
    if (pageIndex >= totalPages - 1) return;
    animatePage(pageIndex + 1, 1);
  }, [animatePage, pageIndex]);

  const goBack = React.useCallback(() => {
    if (pageIndex <= 0) return;
    animatePage(pageIndex - 1, -1);
  }, [animatePage, pageIndex]);

  const grantAccess = React.useCallback(async () => {
    setGrantAttempted(true);
    await openAllFilesAccessSettings();
  }, []);

  const visualAnimatedStyle = React.useMemo(
    () => ({
      opacity: transition.interpolate({
        inputRange: [0, 1],
        outputRange: [0.55, 1]
      }),
      transform: [
        {
          translateX: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [transitionDirection * 28, 0]
          })
        },
        {
          scale: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [0.97, 1]
          })
        }
      ]
    }),
    [transition, transitionDirection]
  );

  const copyAnimatedStyle = React.useMemo(
    () => ({
      opacity: transition,
      transform: [
        {
          translateX: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [transitionDirection * 18, 0]
          })
        }
      ]
    }),
    [transition, transitionDirection]
  );

  const detailsAnimatedStyle = React.useMemo(
    () => ({
      opacity: transition.interpolate({
        inputRange: [0, 1],
        outputRange: [0.2, 1]
      }),
      transform: [
        {
          translateY: transition.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0]
          })
        }
      ]
    }),
    [transition]
  );

  const showSkip = pageIndex < totalPages - 1;
  const showBack = pageIndex > 0;
  const isPermissionPage = pageIndex === totalPages - 1;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <View style={styles.brandBlock}>
          <Text variant="titleSmall" style={{ color: theme.colors.onBackground }}>
            {t('onboarding.appName')}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('onboarding.progress', { current: pageIndex + 1, total: totalPages })}
          </Text>
        </View>
        {showSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void completeOnboarding()}
            style={({ pressed }) => [styles.skipButton, pressed ? { opacity: 0.72 } : null]}
          >
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
              {t('common.skip')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.indicatorRow}>
        {pages.map((page, index) => {
          const width = indicator.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [10, 34, 10],
            extrapolate: 'clamp'
          });
          const opacity = indicator.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0.32, 1, 0.32],
            extrapolate: 'clamp'
          });
          return (
            <Animated.View
              key={`${page.eyebrow}-${index}`}
              style={[
                styles.indicator,
                {
                  width,
                  opacity,
                  backgroundColor: theme.colors.primary
                }
              ]}
            />
          );
        })}
      </View>

      <View style={styles.content}>
        <OnboardingPage
          eyebrow={currentPage.eyebrow}
          title={currentPage.title}
          description={currentPage.description}
          note={currentPage.note}
          heroIcon={currentPage.heroIcon}
          heroLabel={currentPage.heroLabel}
          heroBadges={currentPage.heroBadges}
          highlights={currentPage.highlights}
          statusPanel={currentPage.statusPanel}
          visualAnimatedStyle={visualAnimatedStyle}
          copyAnimatedStyle={copyAnimatedStyle}
          detailsAnimatedStyle={detailsAnimatedStyle}
        />
      </View>

      <Surface elevation={2} style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
        {isPermissionPage && permissionState !== 'granted' ? (
          <Button mode="text" onPress={() => void completeOnboarding()}>
            {t('common.notNow')}
          </Button>
        ) : null}
        <View style={[styles.footerRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {showBack ? (
            <Button mode="text" onPress={goBack} style={styles.flexButton}>
              {t('common.back')}
            </Button>
          ) : (
            <View style={styles.flexButton} />
          )}
          {isPermissionPage ? (
            permissionState === 'granted' ? (
              <Button mode="contained" onPress={() => void completeOnboarding()} style={styles.flexButton}>
                {t('common.start')}
              </Button>
            ) : (
              <Button mode="contained" onPress={() => void grantAccess()} style={styles.flexButton}>
                {t('onboarding.permission.grantAccess')}
              </Button>
            )
          ) : (
            <Button
              mode="contained"
              onPress={goNext}
              style={styles.flexButton}
              contentStyle={pageIndex === 0 ? styles.primaryContent : undefined}
            >
              {pageIndex === 0 ? t('common.getStarted') : t('common.next')}
            </Button>
          )}
        </View>
      </Surface>
    </SafeAreaView>
  );
}

function getPermissionStatusPanel(
  t: (key: string) => string,
  state: ReturnType<typeof getOnboardingPermissionVisualState>
) {
  if (state === 'granted') {
    return {
      icon: 'check-decagram-outline' as const,
      title: t('onboarding.permission.states.granted.title'),
      body: t('onboarding.permission.states.granted.body'),
      tone: 'success' as const
    };
  }

  if (state === 'limited') {
    return {
      icon: 'alert-circle-outline' as const,
      title: t('onboarding.permission.states.limited.title'),
      body: t('onboarding.permission.states.limited.body'),
      tone: 'warning' as const
    };
  }

  if (state === 'checking') {
    return {
      icon: 'progress-clock' as const,
      title: t('onboarding.permission.states.checking.title'),
      body: t('onboarding.permission.states.checking.body'),
      tone: 'info' as const
    };
  }

  return {
    icon: 'shield-outline' as const,
    title: t('onboarding.permission.states.pending.title'),
    body: t('onboarding.permission.states.pending.body'),
    tone: 'info' as const
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10
  },
  brandBlock: {
    gap: 2
  },
  skipButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 18,
    paddingBottom: 10
  },
  indicator: {
    height: 8,
    borderRadius: 999
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18
  },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  footerRow: {
    alignItems: 'center',
    gap: 12
  },
  flexButton: {
    flex: 1
  },
  primaryContent: {
    minHeight: 48
  }
});
