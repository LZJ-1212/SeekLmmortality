import { CREATE_PLAYER_LIMITS } from './constants';
import type { CreatePlayerValidation } from './types';

const STRING_LIMITS: ReadonlyArray<{ key: string; label: string; max: number }> = [
  { key: 'origin', label: '出身', max: CREATE_PLAYER_LIMITS.origin },
  { key: 'daoPursuit', label: '道途', max: CREATE_PLAYER_LIMITS.daoPursuit },
  { key: 'constitution', label: '体质', max: CREATE_PLAYER_LIMITS.constitution },
];

function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * 创角请求体校验：超长 / 非法一律 400，不写库、不调开场 LLM。
 * name 必填；其余字段缺省可空，仅做长度上限。
 */
export function assertCreatePlayerBody(body: unknown): CreatePlayerValidation {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name : '';
  if (name.trim().length === 0) return { ok: false, message: '请赐下尊名。' };
  if (codePointLength(name.trim()) > CREATE_PLAYER_LIMITS.name) {
    return { ok: false, message: `尊名最长 ${CREATE_PLAYER_LIMITS.name} 字。` };
  }

  if (typeof b.gender === 'string' && codePointLength(b.gender) > CREATE_PLAYER_LIMITS.gender) {
    return { ok: false, message: `性别最长 ${CREATE_PLAYER_LIMITS.gender} 字。` };
  }

  for (const { key, label, max } of STRING_LIMITS) {
    const value = b[key];
    if (typeof value === 'string' && codePointLength(value) > max) {
      return { ok: false, message: `${label}最长 ${max} 字。` };
    }
  }

  if (!Array.isArray(b.roots) || b.roots.length < 1) {
    return { ok: false, message: '请至少塑一根灵根。' };
  }
  if (b.roots.length > CREATE_PLAYER_LIMITS.rootsMax) {
    return { ok: false, message: `灵根元素最多 ${CREATE_PLAYER_LIMITS.rootsMax} 项。` };
  }
  for (const root of b.roots) {
    if (typeof root === 'string' && codePointLength(root) > CREATE_PLAYER_LIMITS.rootItem) {
      return { ok: false, message: `灵根元素单字最长 ${CREATE_PLAYER_LIMITS.rootItem} 字。` };
    }
  }

  if (Array.isArray(b.talents)) {
    if (b.talents.length > CREATE_PLAYER_LIMITS.talentsMax) {
      return { ok: false, message: `先天天赋最多 ${CREATE_PLAYER_LIMITS.talentsMax} 项。` };
    }
    for (const talent of b.talents) {
      if (typeof talent === 'string' && codePointLength(talent) > CREATE_PLAYER_LIMITS.talentItem) {
        return { ok: false, message: `天赋名最长 ${CREATE_PLAYER_LIMITS.talentItem} 字。` };
      }
    }
  }

  return { ok: true };
}
