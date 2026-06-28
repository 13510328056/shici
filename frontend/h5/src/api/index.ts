import axios from 'axios'
import type { Poem, DailyPoem, Poet } from '../types'

const api = axios.create({ baseURL: '/api/v1', timeout: 10000 })

export async function getDailyPoem(): Promise<DailyPoem> {
  const r = await api.get('/play/daily')
  return r.data
}

export async function getRandomPoem(): Promise<Poem> {
  const r = await api.get('/play/random')
  return r.data
}

export async function searchAll(keyword: string) {
  const r = await api.get('/search/all', { params: { keyword } })
  return r.data
}

export async function listPoets(dynasty?: string): Promise<{ poets: Poet[]; total: number }> {
  const r = await api.get('/poets', { params: { dynasty, limit: 100 } })
  return r.data
}

export async function getPoetDetail(poetId: string): Promise<Poet> {
  const r = await api.get(`/poets?poet_id=${poetId}`)
  return r.data?.poets?.[0]
}

export async function getPoetPoems(poetId: string): Promise<Poem[]> {
  const r = await api.get(`/poets/${poetId}/poetry`)
  return r.data?.poems || []
}

export async function getRelatedPoems(poetryId: string) {
  const r = await api.get('/play/related', { params: { poetry_id: poetryId } })
  return r.data
}
