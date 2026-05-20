import React from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { Directory, Paths } from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar, Text } from 'react-native-paper';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { hasAllFilesAccess, openAllFilesAccessSettings } from '../native/allFilesAccess';
import { openAppLanguageSettings } from '../native/appLanguage';
import { openOutputFolderPicker, testPickedFolderTimestampSupport } from '../native/outputFolderPicker';
import { usePipelineStore } from '../store/pipelineStore';
import { useHistoryStore } from '../store/historyStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useSettingsStore } from '../store/settingsStore';
import { syncI18nLanguage } from '../i18n';
import { useAppTheme } from '../theme/useAppTheme';
import { WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import type { AppLanguagePreference, AppSettings, DuplicateHandlingMode, OutputOrganizationMode } from '../types/media';
import {
  InfoRow,
  OptionChoiceCard,
  PrimaryButton,
  SecondaryButton,
  SettingsSectionCard,
  SettingRow as UiSettingRow,
  StatusBanner,
  textStyles
} from '../components/AppUi';
import { spacing } from '../theme/designTokens';

const organizationModes: OutputOrganizationMode[] = ['all-in-one', 'by-type', 'by-sender', 'by-sender-and-type'];
const duplicateModes: DuplicateHandlingMode[] = ['keep-both', 'skip-existing', 'replace-existing'];
const languageOptions: AppLanguagePreference[] = ['system', 'en', 'he'];

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSaveLocation = useSettingsStore((state) => state.resetSaveLocation);
  const closeOverlayStage = usePipelineStore((state) => state.closeOverlayStage);
  const requestOnboardingReplay = useOnboardingStore((state) => state.requestReplay);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const [allFilesAccessGranted, setAllFilesAccessGranted] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();
  const [clearCacheOpen, setClearCacheOpen] = React.useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = React.useState(false);
  const [languageBusy, setLanguageBusy] = React.useState(false);
  const [organizationSheetOpen, setOrganizationSheetOpen] = React.useState(false);

  const refreshPermissions = React.useCallback(async () => {
    try {
      setAllFilesAccessGranted(await hasAllFilesAccess());
    } catch {
      setAllFilesAccessGranted(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshPermissions();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissions();
    });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlayStage('welcome');
      return true;
    });
    return () => {
      appStateSubscription.remove();
      backSubscription.remove();
    };
  }, [closeOverlayStage, refreshPermissions]);

  async function chooseFolder() {
    try {
      const folder = await openOutputFolderPicker();
      const support = await testPickedFolderTimestampSupport(folder.treeUri);
      await updateSettings({
        saveDestinationMode: 'custom-folder',
        useDefaultFolder: false,
        customFolder: folder,
        customFolderTimestampSupport: support
      });
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : t('settings.folderPickFailed'));
    }
  }

  async function applyLanguagePreference(languagePreference: AppLanguagePreference) {
    setLanguageBusy(true);
    try {
      await updateSettings({ languagePreference });
      await syncI18nLanguage(languagePreference);
    } finally {
      setLanguageBusy(false);
    }
  }

  async function clearCache() {
    try {
      const cache = new Directory(Paths.cache);
      if (cache.exists) cache.delete();
      setSnackbar(t('settings.cacheClearedBody'));
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : t('settings.couldNotClearCache'));
    } finally {
      setClearCacheOpen(false);
    }
  }

  async function confirmClearHistory() {
    await clearHistory();
    setClearHistoryOpen(false);
    setSnackbar(t('settings.historyCleared'));
  }

  return (
    <WizardScreen
      stage="settings"
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      onBack={() => closeOverlayStage('welcome')}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title={t('settings.saveLocation')} icon="folder-cog-outline">
          <StatusBanner
            tone={allFilesAccessGranted ? 'success' : 'warning'}
            icon={allFilesAccessGranted ? 'shield-check-outline' : 'shield-alert-outline'}
            title={allFilesAccessGranted ? t('settings.permissionReadyTitle') : t('settings.permissionMissingTitle')}
            body={allFilesAccessGranted ? t('settings.granted') : t('settings.notGranted')}
          />
          <DestinationCard
            title={t('settings.defaultAccurateFolder')}
            description={t('settings.defaultAccurateFolderBody')}
            selected={settings.saveDestinationMode === 'default-accurate-folder'}
            badge={t('settings.recommended')}
            onPress={() =>
              void updateSettings({
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
            onPress={() =>
              void updateSettings({
                saveDestinationMode: 'custom-folder',
                useDefaultFolder: false
              })
            }
          />
          <View style={styles.compactButtonRow}>
            <SecondaryButton icon="folder-plus-outline" style={styles.compactButton} onPress={() => void chooseFolder()}>
              {t('settings.chooseFolder')}
            </SecondaryButton>
            <SecondaryButton style={styles.compactButton} onPress={() => void resetSaveLocation()}>
              {t('settings.resetToDefault')}
            </SecondaryButton>
          </View>
          <Detail
            icon={allFilesAccessGranted ? 'shield-check-outline' : 'shield-alert-outline'}
            label={t('settings.allFilesAccess')}
            value={allFilesAccessGranted ? t('settings.granted') : t('settings.notGranted')}
          />
          <SecondaryButton icon="cog-outline" onPress={() => void openAllFilesAccessSettings()}>
            {t('settings.openAllFilesAccess')}
          </SecondaryButton>
          {settings.customFolder ? (
            <Detail
              icon={settings.customFolderTimestampSupport?.timestampVerified ? 'calendar-check-outline' : 'calendar-alert-outline'}
              label={t('settings.customFolderDateAccuracy')}
              value={
                settings.customFolderTimestampSupport?.timestampVerified
                  ? t('settings.customFolderDateAccuracyReady')
                  : t('settings.customFolderDateAccuracyLimited')
              }
            />
          ) : null}
        </Section>

        <Section title={t('settings.outputOrg')} icon="folder-multiple-outline">
          <View style={styles.summaryRow}>
            <Text variant="titleSmall" numberOfLines={2} style={[styles.flex, textStyles.start]}>
              {t(`settings.organizationModes.${settings.outputOrganization.mode}.title`)}
            </Text>
            <SecondaryButton style={styles.compactAction} onPress={() => setOrganizationSheetOpen(true)}>
              {t('settings.change')}
            </SecondaryButton>
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {getOrganizationSummaryText(t, settings.outputOrganization)}
          </Text>
          <UiSettingRow
            title={t('settings.createExportTimestampFolder')}
            value={settings.outputOrganization.createExportTimestampFolder}
            onValueChange={(value) =>
              void updateSettings({
                outputOrganization: { ...settings.outputOrganization, createExportTimestampFolder: value }
              })
            }
          />
          <Text variant="labelLarge">{t('settings.duplicateHandling')}</Text>
          <View style={styles.choiceList}>
            {duplicateModes.map((mode) => (
              <OptionChoiceCard
                key={mode}
                title={t(`settings.duplicateModes.${mode}`)}
                description={t(`outputOptions.duplicateModes.${mode}.body`)}
                selected={settings.outputOrganization.duplicateHandling === mode}
                caution={mode === 'replace-existing'}
                onPress={() =>
                  void updateSettings({
                    outputOrganization: {
                      ...settings.outputOrganization,
                      duplicateHandling: mode
                    }
                  })
                }
              />
            ))}
          </View>
        </Section>

        <Section title={t('settings.language')} icon="translate">
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('settings.languageInfo')}
          </Text>
          <View style={styles.choiceList}>
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
          </View>
          <SecondaryButton
            icon="android"
            onPress={async () => {
              const outcome = await openAppLanguageSettings();
              if (outcome === 'opened-system-settings') {
                setSnackbar(t('settings.languageSettingsFallbackOpened'));
              } else if (outcome === 'unsupported') {
                setSnackbar(t('settings.languageSystemFallback'));
              }
            }}
          >
            {t('settings.openAppLanguageSettings')}
          </SecondaryButton>
        </Section>

        <Section title={t('settings.appearance')} icon="theme-light-dark">
          <View style={styles.choiceList}>
            <OptionChoiceCard
              title={t('settings.systemDefault')}
              description={t('settings.appearanceBodies.system')}
              selected={settings.appearance === 'system'}
              onPress={() => void updateSettings({ appearance: 'system' })}
            />
            <OptionChoiceCard
              title={t('settings.light')}
              description={t('settings.appearanceBodies.light')}
              selected={settings.appearance === 'light'}
              onPress={() => void updateSettings({ appearance: 'light' })}
            />
            <OptionChoiceCard
              title={t('settings.dark')}
              description={t('settings.appearanceBodies.dark')}
              selected={settings.appearance === 'dark'}
              onPress={() => void updateSettings({ appearance: 'dark' })}
            />
          </View>
          <UiSettingRow
            title={t('settings.dynamicColors')}
            description={t('settings.dynamicColorsBody')}
            value={settings.useDynamicColors}
            onValueChange={(value) => void updateSettings({ useDynamicColors: value })}
          />
        </Section>

        <Section title={t('settings.appOptions')} icon="tune-variant">
          <Detail icon="star-four-points-outline" label={t('settings.welcomeTour')} value={t('settings.welcomeTourBody')} />
          <SecondaryButton
            icon="play-circle-outline"
            onPress={() => {
              closeOverlayStage('welcome');
              requestOnboardingReplay();
            }}
          >
            {t('settings.showWelcomeTourAgain')}
          </SecondaryButton>
          <UiSettingRow
            title={t('settings.developerModeToggle')}
            description={t('settings.developerModeBody')}
            value={settings.developerMode}
            onValueChange={(value) => void updateSettings({ developerMode: value, showTechnicalLogs: value ? settings.showTechnicalLogs : false })}
          />
          {settings.developerMode ? (
            <>
              <UiSettingRow title={t('settings.showTechnicalLogs')} value={settings.showTechnicalLogs} onValueChange={(value) => void updateSettings({ showTechnicalLogs: value })} />
              <UiSettingRow title={t('settings.keepCache')} value={settings.keepCacheAfterFailedRun} onValueChange={(value) => void updateSettings({ keepCacheAfterFailedRun: value })} />
              <Detail icon="information-outline" label={t('settings.developerMode')} value={t('settings.developerModeBody')} />
            </>
          ) : null}
          <Detail icon="folder-outline" label={t('settings.lastOutputFolder')} value={settings.lastOutputFolder ?? t('settings.noneYet')} path />
          <Detail
            icon="information-outline"
            label={t('settings.versionBuild')}
            value={`${Application.nativeApplicationVersion ?? '0.1.0'} (${Application.nativeBuildVersion ?? t('settings.devBuild')})`}
          />
          <View style={styles.buttonRow}>
            <SecondaryButton onPress={() => setClearCacheOpen(true)}>
              {t('settings.clearAppCache')}
            </SecondaryButton>
            <SecondaryButton danger onPress={() => setClearHistoryOpen(true)}>
              {t('settings.clearHistory')}
            </SecondaryButton>
          </View>
        </Section>
      </ScrollView>

      <OutputOrganizationSheet
        visible={organizationSheetOpen}
        settings={settings}
        onDismiss={() => setOrganizationSheetOpen(false)}
        onModeChange={(mode) =>
          void updateSettings({
            outputOrganization: { ...settings.outputOrganization, mode }
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
    gap: spacing.card,
    paddingBottom: spacing.section
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  choiceList: {
    gap: spacing.smallGap
  },
  compactButtonRow: {
    flexDirection: 'row',
    gap: spacing.smallGap
  },
  compactAction: {
    alignSelf: 'flex-start'
  },
  compactButton: {
    flex: 1
  },
  flex: {
    flex: 1
  }
});
