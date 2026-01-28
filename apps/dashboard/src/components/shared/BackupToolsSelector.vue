<!--
  @file apps/dashboard/src/components/shared/BackupToolsSelector.vue
  @description Composant réutilisable pour sélectionner et installer les outils de backup.
  Ce composant affiche rsync, rclone et restic avec leur statut d'installation
  et permet à l'utilisateur de choisir lesquels installer.

  @dependencies
  - Vue 3 : Framework frontend
  - Lucide Icons : Icônes pour l'interface

  @fonctions_principales
  - Afficher les outils de backup disponibles avec leur taille
  - Montrer le statut d'installation (installé/non installé)
  - Permettre la sélection multiple des outils à installer
  - Émettre les outils sélectionnés au parent
-->
<template>
  <div class="space-y-3">
    <!-- Header optionnel -->
    <div v-if="showHeader" class="flex items-center gap-2 mb-2">
      <HardDrive class="w-4 h-4 text-slate-500" />
      <span class="text-sm font-medium text-slate-700">{{ t('backup.tools.title') }}</span>
    </div>

    <!-- Liste des outils -->
    <div class="grid gap-2">
      <label
        v-for="tool in tools"
        :key="tool.id"
        :class="[
          'relative flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
          isSelected(tool.id)
            ? 'border-blue-500 bg-blue-50'
            : tool.installed
              ? 'border-green-200 bg-green-50'
              : 'border-slate-200 hover:border-slate-300',
        ]"
      >
        <input
          type="checkbox"
          :checked="isSelected(tool.id)"
          :disabled="tool.installed && !allowReinstall"
          @change="toggleTool(tool.id)"
          class="sr-only"
        />

        <!-- Icône de l'outil -->
        <div
          :class="[
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            tool.installed ? 'bg-green-100' : 'bg-slate-100',
          ]"
        >
          <span
            :class="[
              'text-sm font-bold',
              tool.installed ? 'text-green-600' : 'text-slate-600',
            ]"
          >
            {{ tool.icon }}
          </span>
        </div>

        <!-- Infos de l'outil -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-900 text-sm">{{ tool.name }}</span>
            <span
              v-if="tool.installed"
              class="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded"
            >
              {{ t('backup.tools.installed') }}
            </span>
          </div>
          <p class="text-xs text-slate-500 truncate">{{ tool.description }}</p>
        </div>

        <!-- Taille -->
        <div class="text-right flex-shrink-0">
          <span class="text-xs text-slate-400">{{ tool.size }}</span>
        </div>

        <!-- Checkbox visuel -->
        <div
          :class="[
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            isSelected(tool.id)
              ? 'bg-blue-500 border-blue-500'
              : tool.installed
                ? 'bg-green-500 border-green-500'
                : 'border-slate-300',
          ]"
        >
          <Check
            v-if="isSelected(tool.id) || tool.installed"
            class="w-3 h-3 text-white"
          />
        </div>
      </label>
    </div>

    <!-- Message si tous installés -->
    <div
      v-if="allInstalled && showAllInstalledMessage"
      class="p-3 bg-green-50 border border-green-200 rounded-lg"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-green-600" />
        <span class="text-sm text-green-700">{{ t('backup.tools.allInstalled') }}</span>
      </div>
    </div>

    <!-- Info cloud sync -->
    <div
      v-if="showCloudSyncInfo && (isSelected('rclone') || toolsStatus.rclone)"
      class="p-3 bg-blue-50 border border-blue-200 rounded-lg"
    >
      <div class="flex items-start gap-2">
        <Cloud class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <span class="text-sm font-medium text-blue-900">{{ t('backup.tools.cloudSyncAvailable') }}</span>
          <p class="text-xs text-blue-700 mt-0.5">{{ t('backup.tools.cloudSyncDesc') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { HardDrive, Check, CheckCircle2, Cloud } from 'lucide-vue-next';

const { t } = useI18n();

export interface BackupTool {
  id: 'rsync' | 'rclone' | 'restic';
  name: string;
  description: string;
  icon: string;
  size: string;
  installed: boolean;
}

const props = withDefaults(
  defineProps<{
    /** Statut d'installation actuel des outils */
    toolsStatus: {
      rsync: boolean;
      rclone: boolean;
      restic: boolean;
    };
    /** Outils sélectionnés pour installation */
    modelValue: string[];
    /** Afficher le header */
    showHeader?: boolean;
    /** Afficher le message si tous installés */
    showAllInstalledMessage?: boolean;
    /** Afficher l'info cloud sync */
    showCloudSyncInfo?: boolean;
    /** Permettre de réinstaller un outil déjà installé */
    allowReinstall?: boolean;
  }>(),
  {
    showHeader: true,
    showAllInstalledMessage: true,
    showCloudSyncInfo: true,
    allowReinstall: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const tools = computed<BackupTool[]>(() => [
  {
    id: 'rsync',
    name: 'Rsync',
    description: t('backup.tools.rsync.description'),
    icon: 'RS',
    size: '~5MB',
    installed: props.toolsStatus.rsync,
  },
  {
    id: 'rclone',
    name: 'Rclone',
    description: t('backup.tools.rclone.description'),
    icon: 'RC',
    size: '~50MB',
    installed: props.toolsStatus.rclone,
  },
  {
    id: 'restic',
    name: 'Restic',
    description: t('backup.tools.restic.description'),
    icon: 'RT',
    size: '~30MB',
    installed: props.toolsStatus.restic,
  },
]);

const allInstalled = computed(() =>
  tools.value.every((tool) => tool.installed),
);

function isSelected(toolId: string): boolean {
  return props.modelValue.includes(toolId);
}

function toggleTool(toolId: string): void {
  const tool = tools.value.find((t) => t.id === toolId);

  // Si déjà installé et pas de réinstallation autorisée, ne rien faire
  if (tool?.installed && !props.allowReinstall) {
    return;
  }

  const newValue = isSelected(toolId)
    ? props.modelValue.filter((id) => id !== toolId)
    : [...props.modelValue, toolId];

  emit('update:modelValue', newValue);
}
</script>
