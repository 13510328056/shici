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
  const r = await api.get('/poets', { params: { dynasty, limit: 200 } })
  return r.data
}

export async function getPoetDetail(poetId: string): Promise<Poet | undefined> {
  const r = await api.get('/poets', { params: { limit: 500 } })
  return (r.data?.poets || []).find((p: any) => p.poet_id === poetId)
}

export async function getPoetPoems(poetId: string): Promise<Poem[]> {
  const r = await api.get(`/poets/${poetId}/poetry`)
  return r.data?.poems || []
}

export async function getPoemById(id: string): Promise<Poem> {
  const r = await api.get(`/play/poem/${id}`)
  return r.data
}

export async function getRelatedPoems(poetryId: string) {
  const r = await api.get('/play/related', { params: { poetry_id: poetryId } })
  return r.data
}

export async function getGenreData(genreType: string): Promise<import('../types').GenreMeta> {
  const r = await api.get(`/play/genre/${encodeURIComponent(genreType)}`)
  return r.data
}

export async function searchPoetry(params: Record<string, any>) {
  const r = await api.get('/search/poetry', { params })
  return r.data
}
