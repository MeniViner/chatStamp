import React from 'react';
import { Animated, I18nManager, StyleSheet, View, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme/useAppTheme';

type OnboardingHighlight = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
};

type OnboardingStatusPanel = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  tone: 'info' | 'success' | 'warning';
};

type OnboardingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
  heroIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  heroLabel: string;
  heroBadges: string[];
  highlights: OnboardingHighlight[];
  statusPanel?: OnboardingStatusPanel;
  visualAnimatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
  copyAnimatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
  detailsAnimatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
};

export function OnboardingPage({
  eyebrow,
  title,
  description,
  note,
  heroIcon,
  heroLabel,
  heroBadges,
  highlights,
  statusPanel,
  visualAnimatedStyle,
  copyAnimatedStyle,
  detailsAnimatedStyle
}: OnboardingPageProps) {
  const theme = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const panelColors = getPanelColors(statusPanel?.tone ?? 'info', theme);

  return (
    <View style={styles.page}>
      <Animated.View style={visualAnimatedStyle}>
        <Surface
          elevation={0}
          style={[
            styles.heroShell,
            {
              backgroundColor: theme.colors.surfaceContainerLow ?? theme.colors.surface,
              borderColor: theme.colors.outlineVariant
            }
          ]}
        >
          <View
            style={[
              styles.heroGlow,
              {
                backgroundColor: theme.colors.primaryContainer
              }
            ]}
          />
          <Surface
            elevation={1}
            style={[
              styles.heroCore,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant
              }
            ]}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name={heroIcon} size={38} color={theme.colors.primary} />
            </View>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {heroLabel}
            </Text>
          </Surface>
          <Surface
            elevation={1}
            style={[
              styles.floatingCard,
              styles.floatingTop,
              {
                backgroundColor: theme.colors.secondaryContainer,
                borderColor: theme.colors.outlineVariant
              }
            ]}
          >
            <MaterialCommunityIcons name="calendar-check-outline" size={18} color={theme.colors.secondary} />
            <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
              {heroBadges[0]}
            </Text>
          </Surface>
          <Surface
            elevation={1}
            style={[
              styles.floatingCard,
              styles.floatingBottom,
              {
                backgroundColor: theme.colors.tertiaryContainer,
                borderColor: theme.colors.outlineVariant
              }
            ]}
          >
            <MaterialCommunityIcons name="shield-lock-outline" size={18} color={theme.colors.tertiary} />
            <Text variant="labelMedium" style={{ color: theme.colors.onTertiaryContainer }}>
              {heroBadges[1]}
            </Text>
          </Surface>
        </Surface>
      </Animated.View>

      <Animated.View style={[styles.copyBlock, copyAnimatedStyle]}>
        <Text
          variant="labelLarge"
          style={[
            styles.eyebrow,
            {
              color: theme.colors.primary,
              textAlign: isRtl ? 'right' : 'left'
            }
          ]}
        >
          {eyebrow}
        </Text>
        <Text
          variant="headlineMedium"
          style={[
            styles.title,
            {
              color: theme.colors.onBackground,
              textAlign: isRtl ? 'right' : 'left'
            }
          ]}
        >
          {title}
        </Text>
        <Text
          variant="bodyLarge"
          style={[
            styles.description,
            {
              color: theme.colors.onSurfaceVariant,
              textAlign: isRtl ? 'right' : 'left'
            }
          ]}
        >
          {description}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.detailsBlock, detailsAnimatedStyle]}>
        <View style={styles.highlightList}>
          {highlights.map((highlight) => (
            <Surface
              key={highlight.label}
              elevation={0}
              style={[
                styles.highlightCard,
                {
                  backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant
                }
              ]}
            >
              <MaterialCommunityIcons name={highlight.icon} size={18} color={theme.colors.secondary} />
              <Text variant="bodyMedium" style={styles.flex}>
                {highlight.label}
              </Text>
            </Surface>
          ))}
        </View>

        {statusPanel ? (
          <Surface
            elevation={0}
            style={[
              styles.statusPanel,
              {
                backgroundColor: panelColors.backgroundColor,
                borderColor: panelColors.borderColor
              }
            ]}
          >
            <MaterialCommunityIcons name={statusPanel.icon} size={20} color={panelColors.iconColor} />
            <View style={styles.flex}>
              <Text variant="titleSmall" style={{ color: panelColors.textColor }}>
                {statusPanel.title}
              </Text>
              <Text variant="bodyMedium" style={{ color: panelColors.textColor }}>
                {statusPanel.body}
              </Text>
            </View>
          </Surface>
        ) : null}

        {note ? (
          <Text
            variant="bodyMedium"
            style={[
              styles.note,
              {
                color: theme.colors.onSurfaceVariant,
                textAlign: isRtl ? 'right' : 'left'
              }
            ]}
          >
            {note}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

function getPanelColors(tone: OnboardingStatusPanel['tone'], theme: ReturnType<typeof useAppTheme>) {
  if (tone === 'success') {
    return {
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.primary,
      iconColor: theme.colors.primary,
      textColor: theme.colors.onPrimaryContainer
    };
  }

  if (tone === 'warning') {
    return {
      backgroundColor: theme.colors.secondaryContainer,
      borderColor: theme.colors.secondary,
      iconColor: theme.colors.secondary,
      textColor: theme.colors.onSecondaryContainer
    };
  }

  return {
    backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
    borderColor: theme.colors.outlineVariant,
    iconColor: theme.colors.primary,
    textColor: theme.colors.onSurface
  };
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 24
  },
  heroShell: {
    minHeight: 250,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20
  },
  heroGlow: {
    position: 'absolute',
    top: -90,
    left: -32,
    right: -32,
    height: 220,
    borderRadius: 999,
    opacity: 0.92
  },
  heroCore: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
    minWidth: 210,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  heroIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  floatingCard: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  floatingTop: {
    top: 20,
    right: 18
  },
  floatingBottom: {
    bottom: 18,
    left: 18
  },
  copyBlock: {
    gap: 8
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 0.4
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0
  },
  description: {
    lineHeight: 26
  },
  detailsBlock: {
    gap: 16
  },
  highlightList: {
    gap: 10
  },
  highlightCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  statusPanel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16
  },
  note: {
    lineHeight: 22
  },
  flex: {
    flex: 1
  }
});

