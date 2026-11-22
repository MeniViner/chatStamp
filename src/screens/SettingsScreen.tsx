import React from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar, Text } from 'react-native-paper';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { openAppLanguageSettings } from '../native/appLanguage';
import { openOutputFolderPicker } from '../native/outputFolderPicker';
import { usePipelineStore } from '../store/pipelineStore';
import { useHistoryStore } from '../store/historyStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useSettingsStore, type AppSettingsPatch } from '../store/settingsStore';
import { syncI18nLanguage } from '../i18n';
import { useLanguageRestartStore } from '../store/languageRestartStore';
import { discardImport } from '../services/operationCoordinator';
import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import { useAppTheme } from '../theme/useAppTheme';
import { WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import type { AppLanguagePreference, AppSettings, DuplicateHandlingMode, OutputOrganizationMode } from '../types/media';
import {
  AppLogo,
  InfoRow,
  ListGroup,
  ListItem,
  NavigationItem,
  OptionChoiceCard,
  PrimaryButton,
  SecondaryButton,
  SettingsSectionCard,
  SettingRow as UiSettingRow,
  surfaceRoles,
  textStyles
} from '../components/AppUi';
import { radius, spacing } from '../theme/designTokens';

const appearanceModes: AppSettings['appearance'][] = ['system', 'light', 'dark'];

const organizationModes: OutputOrganizationMode[] = ['all-in-one', 'by-type', 'by-sender', 'by-sender-and-type'];
const duplicateModes: DuplicateHandlingMode[] = ['keep-both', 'skip-existing', 'replace-existing'];
const languageOptions: AppLanguagePreference[] = ['system', 'en', 'he'];
type SettingsCategory = 'saving' | 'language' | 'appearance' | 'storage' | 'help' | 'advanced';

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSaveLocation = useSettingsStore((state) => state.resetSaveLocation);
  const closeOverlayStage = usePipelineStore((state) => state.closeOverlayStage);
  const requestOnboardingReplay = useOnboardingStore((state) => state.requestReplay);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();
  const [clearCacheOpen, setClearCacheOpen] = React.useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = React.useState(false);
  const [languageBusy, setLanguageBusy] = React.useState(false);
  const languageReserved = React.useRef(false);
  const restartRequired = useLanguageRestartStore((state) => state.required);
  const [organizationSheetOpen, setOrganizationSheetOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SettingsCategory | null>(null);
  const categories = [
    { id: 'saving', title: t('settings.categories.saving.title'), summary: t('settings.categories.saving.summary'), icon: 'folder-cog-outline' },
    { id: 'language', title: t('settings.language'), summary: t('settings.categories.language.summary'), icon: 'translate' },
    { id: 'appearance', title: t('settings.appearance'), summary: t('settings.categories.appearance.summary'), icon: 'theme-light-dark' },
    { id: 'storage', title: t('settings.categories.storage.title'), summary: t('settings.categories.storage.summary'), icon: 'history' },
    { id: 'help', title: t('settings.categories.help.title'), summary: t('settings.categories.help.summary'), icon: 'help-circle-outline' },
    { id: 'advanced', title: t('settings.categories.advanced.title'), summary: t('settings.categories.advanced.summary'), icon: 'tune-variant' }
  ] as const;
  const currentCategory = categories.find((entry) => entry.id === category);
  const appVersion = `\u200e${Application.nativeApplicationVersion ?? '0.1.0'} (${Application.nativeBuildVersion ?? t('settings.devBuild')})`;

  const goBack = React.useCallback(() => {
    if (organizationSheetOpen) setOrganizationSheetOpen(false);
    else if (clearCacheOpen) setClearCacheOpen(false);
    else if (clearHistoryOpen) setClearHistoryOpen(false);
    else if (category !== null) setCategory(null);
    else closeOverlayStage('welcome');
  }, [category, clearCacheOpen, clearHistoryOpen, closeOverlayStage, organizationSheetOpen]);

  React.useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => {
      backSubscription.remove();
    };
  }, [goBack]);

  async function saveSettings(patch: AppSettingsPatch) {
    try { await updateSettings(patch); } catch { setSnackbar(t('settings.saveFailed')); }
  }

  async function chooseFolder() {
    try {
      const folder = await openOutputFolderPicker();
      if (!folder) return;
      if (!folder.persistedPermission) {
        setSnackbar(t('settings.folderPickFailed'));
        return;
      }
      await updateSettings({
        saveDestinationMode: 'custom-folder',
        useDefaultFolder: false,
        customFolder: folder,
        customFolderTimestampSupport: null
      });
    } catch {
      setSnackbar(t('settings.folderPickFailed'));
    }
  }

  async function applyLanguagePreference(languagePreference: AppLanguagePreference) {
    if (languageReserved.current) return;
    languageReserved.current = true; setLanguageBusy(true);
    try {
      await updateSettings({ languagePreference });
      const required = await syncI18nLanguage(languagePreference);
      useLanguageRestartStore.getState().setRequired(required, required);
    } catch {
      setSnackbar(t('settings.saveFailed'));
    } finally {
      languageReserved.current = false; setLanguageBusy(false);
    }
  }

  async function clearCache() {
    try {
      if (usePipelineStore.getState().workingDirectory) await discardImport();
      await getChatStampNativeModule().cleanupStaleJobsAsync();
      setSnackbar(t('settings.cacheClearedBody'));
    } catch {
      setSnackbar(t('settings.couldNotClearCache'));
    } finally {
      setClearCacheOpen(false);
    }
  }

  async function confirmClearHistory() {
    try {
      await clearHistory();
      setClearHistoryOpen(false);
      setSnackbar(t('settings.historyCleared'));
    } catch { setSnackbar(t('settings.saveFailed')); }
  }

  async function openSupportLink(url: string) {
    try { await Linking.openURL(url); } catch { setSnackbar(t('settings.couldNotOpenLink')); }
  }

  const menuGroups = [categories.slice(0, 3), categories.slice(3)];
  return (
    <WizardScreen
      stage="settings"
      title={currentCategory?.title ?? t('settings.title')}
      subtitle={currentCategory?.summary}
      onBack={goBack}
    >
      <ScrollView key={category ?? 'menu'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {category === null ? <>
          {menuGroups.map((group, index) => <ListGroup key={index}>
            {group.map((entry) => <NavigationItem key={entry.id} icon={entry.icon} title={entry.title}
              description={entry.summary} onPress={() => setCategory(entry.id)} />)}
          </ListGroup>)}
          <ListGroup style={styles.aboutGroup}>
            <ListItem leading={<AppLogo />}
              title={t('onboarding.appName')} description={appVersion} onPress={() => setCategory('help')} />
          </ListGroup>
        </> : null}
        {category === 'saving' ? <>
        <Section title={t('settings.saveLocation')} icon="folder-cog-outline">
          <ListGroup>
            <DestinationCard
              title={t('settings.defaultAccurateFolder')}
              description={t('settings.defaultAccurateFolderBody')}
              selected={settings.saveDestinationMode === 'default-accurate-folder'}
              badge={t('settings.recommended')}
              onPress={() =>
                void saveSettings({
                  saveDestinationMode: 'default-accurate-folder',
                  useDefaultFolder: true
                })
              }
            />
            <DestinationCard
              title={t('settings.customFolder')}
              description={
                settings.customFolder?.readablePathLabel ??
                settings.customFolder?.displayName ??
                t('settings.customFolderBody')
              }
              selected={settings.saveDestinationMode === 'custom-folder'}
              onPress={() => void chooseFolder()}
            />
            <ListItem icon="folder-plus-outline" title={t('settings.chooseFolder')} onPress={() => void chooseFolder()} />
            <ListItem icon="restore" title={t('settings.resetToDefault')}
              onPress={() => { void resetSaveLocation().catch(() => setSnackbar(t('settings.saveFailed'))); }} />
          </ListGroup>
          <ListGroup>
            {settings.saveDestinationMode === 'custom-folder' ? (
              <Detail icon="calendar-outline" label={t('settings.customFolderDateAccuracy')} value={t('settings.customFolderDateBody')} />
            ) : null}
            <UiSettingRow
              icon="calendar-sync-outline"
              title={t('settings.alwaysUseMessageDate')}
              description={t('settings.alwaysUseMessageDateBody')}
              value={settings.alwaysUseMessageDate}
              onValueChange={(alwaysUseMessageDate) => void saveSettings({ alwaysUseMessageDate })}
            />
            <Detail icon="folder-outline" label={t('settings.lastOutputFolder')} value={settings.lastOutputFolder ?? t('settings.noneYet')} path />
          </ListGroup>
        </Section>

        <Section title={t('settings.outputOrg')} icon="folder-multiple-outline">
          <ListGroup>
            <ListItem icon="file-tree-outline"
              title={t(`settings.organizationModes.${settings.outputOrganization.mode}.title`)}
              description={getOrganizationSummaryText(t, settings.outputOrganization)}
              onPress={() => setOrganizationSheetOpen(true)}
              trailing={<Text variant="labelLarge" style={{ color: theme.colors.primary }}>{t('settings.change')}</Text>} />
            <UiSettingRow
              icon="folder-clock-outline"
              title={t('settings.createExportTimestampFolder')}
              value={settings.outputOrganization.createExportTimestampFolder}
              onValueChange={(value) =>
                void saveSettings({
                  outputOrganization: { createExportTimestampFolder: value }
                })
              }
            />
          </ListGroup>
        </Section>

        <Section title={t('settings.duplicateHandling')} icon="content-duplicate">
          <ListGroup>
            {duplicateModes.map((mode) => (
              <OptionChoiceCard
                key={mode}
                title={t(`settings.duplicateModes.${mode}`)}
                description={t(`outputOptions.duplicateModes.${mode}.body`)}
                selected={settings.outputOrganization.duplicateHandling === mode}
                caution={mode === 'replace-existing'}
                onPress={() =>
                  void saveSettings({
                    outputOrganization: { duplicateHandling: mode }
                  })
                }
              />
            ))}
          </ListGroup>
        </Section>
        </> : null}

        {category === 'language' ?
        <Section title={t('settings.language')} icon="translate">
          <Text variant="bodyMedium" style={[styles.note, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {t('settings.languageInfo')}
          </Text>
          {restartRequired ? <SecondaryButton icon="restart" onPress={() => useLanguageRestartStore.getState().requestPrompt()}>{t('languageRestart.now')}</SecondaryButton> : null}
          <ListGroup>
            {languageOptions.map((languagePreference) => (
              <OptionChoiceCard
                key={languagePreference}
                title={t(`settings.languageOptions.${languagePreference}`)}
                description={t(`settings.languageBodies.${languagePreference}`)}
                selected={settings.languagePreference === languagePreference}
                disabled={languageBusy}
                onPress={() => void applyLanguagePreference(languagePreference)}
              />
            ))}
          </ListGroup>
          <ListGroup>
            <NavigationItem
              icon="android"
              title={t('settings.openAppLanguageSettings')}
              onPress={() => {
                void openAppLanguageSettings().then((outcome) => {
                  if (outcome === 'opened-system-settings') setSnackbar(t('settings.languageSettingsFallbackOpened'));
                  else if (outcome === 'unsupported') setSnackbar(t('settings.languageSystemFallback'));
                });
              }}
            />
          </ListGroup>
        </Section>
        : null}

        {category === 'appearance' ?
        <Section title={t('settings.appearance')} icon="palette-outline">
          <ListGroup>
            <ThemeModeSelector value={settings.appearance} onChange={(appearance) => void saveSettings({ appearance })} />
            <UiSettingRow
              icon="palette-swatch-variant"
              title={t('settings.dynamicColors')}
              description={t('settings.dynamicColorsBody')}
              value={settings.useDynamicColors}
              onValueChange={(value) => void saveSettings({ useDynamicColors: value })}
            />
          </ListGroup>
        </Section>
        : null}

        {category === 'help' ? <>
        <Section title={t('settings.privacySupport')} icon="shield-account-outline">
          <Text variant="bodyMedium" style={[styles.note, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t('settings.privacySummary')}</Text>
          <ListGroup>
            <NavigationItem icon="shield-lock-outline" title={t('settings.privacyPolicy')}
              onPress={() => void openSupportLink('https://meniviner.github.io/chatStamp/privacy-policy.html')} />
            <NavigationItem icon="email-outline" title={t('settings.contactSupport')}
              onPress={() => void openSupportLink('mailto:menis10tec@gmail.com')} />
          </ListGroup>
        </Section>

        <Section title={t('settings.appOptions')} icon="tune-variant">
          <ListGroup>
            <NavigationItem icon="play-circle-outline" title={t('settings.showWelcomeTourAgain')}
              description={t('settings.welcomeTourBody')} onPress={() => requestOnboardingReplay()} />
            <Detail icon="information-outline" label={t('settings.versionBuild')} value={appVersion} />
          </ListGroup>
        </Section>
        </> : null}

        {category === 'advanced' ?
        <Section title={t('settings.developerMode')} icon="code-braces">
          <ListGroup>
            <UiSettingRow
              icon="bug-outline"
              title={t('settings.developerModeToggle')}
              description={t('settings.developerModeBody')}
              value={settings.developerMode}
              onValueChange={(value) => void saveSettings(value ? { developerMode: true } : { developerMode: false, showTechnicalLogs: false })}
            />
            {settings.developerMode ? <UiSettingRow icon="text-box-search-outline" title={t('settings.showTechnicalLogs')}
              value={settings.showTechnicalLogs} onValueChange={(value) => void saveSettings({ showTechnicalLogs: value })} /> : null}
            {settings.developerMode ? <UiSettingRow icon="archive-outline" title={t('settings.keepCache')}
              value={settings.keepCacheAfterFailedRun} onValueChange={(value) => void saveSettings({ keepCacheAfterFailedRun: value })} /> : null}
          </ListGroup>
        </Section>
        : null}

        {category === 'storage' ?
        <Section title={t('settings.categories.storage.title')} icon="database-outline">
          <ListGroup>
            <ListItem icon="broom" title={t('settings.clearAppCache')} description={t('settings.clearCacheBody')}
              onPress={() => setClearCacheOpen(true)} />
            <ListItem icon="delete-outline" iconTone="error" title={t('settings.clearHistory')} description={t('settings.clearHistoryBody')}
              onPress={() => setClearHistoryOpen(true)} />
          </ListGroup>
        </Section>
        : null}
      </ScrollView>

      <OutputOrganizationSheet
        visible={organizationSheetOpen}
        settings={settings}
        onDismiss={() => setOrganizationSheetOpen(false)}
        onModeChange={(mode) =>
          void saveSettings({
            outputOrganization: { mode }
          })
        }
      />

      <ConfirmDialog
        visible={clearCacheOpen}
        title={t('settings.clearCacheTitle')}
        body={t('settings.clearCacheBody')}
        confirmLabel={t('settings.clearAppCache')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void clearCache()}
        onDismiss={() => setClearCacheOpen(false)}
      />
      <ConfirmDialog
        visible={clearHistoryOpen}
        title={t('settings.clearHistoryTitle')}
        body={t('settings.clearHistoryBody')}
        confirmLabel={t('settings.clearHistory')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void confirmClearHistory()}
        onDismiss={() => setClearHistoryOpen(false)}
      />
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function OutputOrganizationSheet({
  visible,
  settings,
  onDismiss,
  onModeChange
}: {
  visible: boolean;
  settings: AppSettings;
  onDismiss: () => void;
  onModeChange: (mode: OutputOrganizationMode) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <BottomSheet
      visible={visible}
      title={t('settings.outputOrg')}
      subtitle={t('settings.outputOrgSubtitle')}
      onDismiss={onDismiss}
      footer={<PrimaryButton onPress={onDismiss}>{t('common.ok')}</PrimaryButton>}
    >
      <ListGroup>
        {organizationModes.map((mode) => (
          <PressCard
            key={mode}
            title={t(`settings.organizationModes.${mode}.title`)}
            body={t(`settings.organizationModes.${mode}.body`)}
            example={t(`settings.organizationModes.${mode}.example`)}
            selected={settings.outputOrganization.mode === mode}
            onPress={() => onModeChange(mode)}
          />
        ))}
      </ListGroup>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('settings.outputOrgFooter')}
      </Text>
    </BottomSheet>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; children: React.ReactNode }) {
  return <SettingsSectionCard title={title} icon={icon}>{children}</SettingsSectionCard>;
}

function DestinationCard({
  title,
  description,
  selected,
  onPress,
  badge
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <OptionChoiceCard
      title={title}
      description={description}
      selected={selected}
      badge={badge}
      showRadio={false}
      onPress={onPress}
      technicalDetail={description.includes('/') || description.includes('\\') ? description : undefined}
    />
  );
}

function PressCard({
  title,
  body,
  example,
  selected,
  onPress
}: {
  title: string;
  body: string;
  example: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <OptionChoiceCard title={title} description={body} technicalDetail={example} selected={selected} onPress={onPress} />
  );
}

function Detail({ icon, label, value, path = false }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string; path?: boolean }) {
  return <InfoRow icon={icon} label={label} value={value} path={path} />;
}

const appearanceIcons = { system: 'brightness-auto', light: 'white-balance-sunny', dark: 'weather-night' } as const;

/** Three round mode buttons, with the selected mode shown as a filled rounded square. */
function ThemeModeSelector({ value, onChange }: { value: AppSettings['appearance']; onChange: (value: AppSettings['appearance']) => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const label = (mode: AppSettings['appearance']) => t(mode === 'system' ? 'settings.systemDefault' : `settings.${mode}`);
  return (
    <View style={styles.themeSelector}>
      <View style={styles.themeOptions} accessibilityRole="radiogroup">
        {appearanceModes.map((mode) => {
          const selected = value === mode;
          return (
            <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label(mode)}
              onPress={() => onChange(mode)} style={styles.themeOption}>
              <View style={[styles.themeIcon, {
                borderRadius: selected ? radius.card / 1.5 : 32,
                backgroundColor: selected ? theme.colors.secondaryContainer : surfaceRoles(theme).groupPressed
              }]}>
                <MaterialCommunityIcons name={appearanceIcons[mode]} size={26}
                  color={selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant} />
              </View>
              <Text variant="labelLarge" numberOfLines={2} style={[styles.themeLabel, { color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>{label(mode)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t(`settings.appearanceBodies.${value}`)}</Text>
    </View>
  );
}

function getOrganizationSummaryText(
  t: (key: string) => string,
  organization: AppSettings['outputOrganization']
): string {
  const parts = [t(`settings.organizationModes.${organization.mode}.title`)];
  parts.push(organization.createExportTimestampFolder ? t('settings.createExportTimestampFolder') : t('settings.noExportTimestampFolder'));
  parts.push(t(`settings.duplicateModes.${organization.duplicateHandling}`));
  return parts.join(' • ');
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    paddingBottom: spacing.section
  },
  note: {
    paddingHorizontal: spacing.tinyGap
  },
  aboutGroup: {
    marginTop: spacing.smallGap
  },
  themeSelector: {
    padding: spacing.compactInner,
    gap: spacing.gap
  },
  themeOptions: {
    flexDirection: 'row',
    gap: spacing.smallGap
  },
  themeOption: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.smallGap,
    paddingVertical: spacing.tinyGap
  },
  themeLabel: {
    textAlign: 'center'
  },
  themeIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
