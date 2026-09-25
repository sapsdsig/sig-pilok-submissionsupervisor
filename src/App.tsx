import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DistributorSection } from './components/DistributorSection'
import { FieldError } from './components/FieldError'
import { ActionBar, FormShell, SectionCard, SectionHeader, StatusBanner } from './components/FormLayout'
import { CheckIcon } from './components/icons'
import { WilayahCard } from './components/WilayahCard'
import { createSupervisorFormSchema } from './schemas/supervisorFormSchema'
import { ApiClientError } from './services/apiClient'
import { apService, getAutoSelectedAp } from './services/apService'
import { distributorService } from './services/distributorService'
import { submissionService } from './services/submissionService'
import { uploadService } from './services/uploadService'
import type { StoredSubmission, StoredSupervisor, SubmissionRequest, SubmissionResult } from './types/api'
import { createDefaultFormValues, type SupervisorFormValues } from './types/form'
import type { ApOption, Distributor } from './types/masterData'
import { focusFirstInvalidField } from './utils/formFocus'
import { createRequestToken } from './utils/requestToken'
import { normalizeSubmission } from './utils/submission'

type FormMode = { kind: 'create' } | { kind: 'edit'; submissionId: string }
type LookupStatus = 'idle' | 'loading' | 'create' | 'edit' | 'error'
type ProcessingStatus = { stage: 'upload'; supervisorNo: number; fileName: string; progress: number } | { stage: 'persistence' }
type PendingSwitch = { kind: 'distributor' | 'ap'; value: string }

const supervisorsToForm = (items: StoredSupervisor[]) => items.map((item) =>
  item.source === 'baseline'
    ? { supervisorId: item.supervisorId, idMdxl: item.idMdxl ?? '', source: 'baseline' as const, namaSupervisor: item.namaSupervisor, ktp: { kind: 'not-required' as const } }
    : { supervisorId: item.supervisorId, source: 'custom' as const, namaSupervisor: item.namaSupervisor, ktp: { kind: 'existing' as const } },
)

const storedToForm = (stored: StoredSubmission): SupervisorFormValues => ({
  namaDistributor: stored.namaDistributor,
  ap: stored.ap,
  submissionAreaId: stored.submissionAreaId,
  supervisors: supervisorsToForm(stored.supervisors),
})

function App() {
  const schema = useMemo(() => createSupervisorFormSchema({
    isKnownDistributor: (name) => distributorService.isKnownDistributor(name),
    isKnownAp: (vendor, ap) => apService.isKnownAp(vendor, ap),
  }), [])
  const methods = useForm<SupervisorFormValues>({
    resolver: zodResolver(schema), defaultValues: createDefaultFormValues(),
    mode: 'onSubmit', reValidateMode: 'onChange', shouldFocusError: false,
  })
  const { getValues, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = methods
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [apOptions, setApOptions] = useState<ApOption[]>([])
  const [masterError, setMasterError] = useState<string>()
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [loadingAp, setLoadingAp] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [mode, setMode] = useState<FormMode>()
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>()
  const [submissionError, setSubmissionError] = useState<string>()
  const [successResult, setSuccessResult] = useState<SubmissionResult>()
  const [editSuccess, setEditSuccess] = useState<SubmissionResult>()
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>()
  const processingRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  const loadMasters = useCallback(async () => {
    setLoadingMaster(true); setMasterError(undefined)
    try { setDistributors(await distributorService.getDistributors()) }
    catch (error) { setDistributors([]); setMasterError(error instanceof ApiClientError ? error.message : 'Master data gagal dimuat. Silakan coba kembali.') }
    finally { setLoadingMaster(false) }
  }, [])
  useEffect(() => { void loadMasters() }, [loadMasters])

  const loadIdentity = useCallback(async (namaDistributor: string, ap: string) => {
    setLookupStatus('loading'); setMode(undefined); setMasterError(undefined); setSubmissionError(undefined); setEditSuccess(undefined)
    reset({ namaDistributor, ap, supervisors: [] })
    try {
      const result = await submissionService.findByDistributorAp(namaDistributor, ap)
      if (getValues('namaDistributor') !== namaDistributor || getValues('ap') !== ap) return
      if (result.exists) {
        reset(storedToForm(result.submission)); setMode({ kind: 'edit', submissionId: result.submission.submissionId }); setLookupStatus('edit')
      } else {
        reset({ namaDistributor, ap, supervisors: supervisorsToForm(result.supervisors) }); setMode({ kind: 'create' }); setLookupStatus('create')
      }
    } catch (error) {
      if (getValues('namaDistributor') !== namaDistributor || getValues('ap') !== ap) return
      setMode(undefined); setLookupStatus('error')
      setMasterError(error instanceof ApiClientError ? error.message : 'Pemeriksaan data tersimpan gagal. Coba kembali.')
    }
  }, [getValues, reset])

  const applyDistributor = useCallback(async (namaDistributor: string) => {
    setMode(undefined); setLookupStatus('idle'); setApOptions([]); setMasterError(undefined)
    reset({ namaDistributor, ap: '', supervisors: [] })
    if (!namaDistributor) return
    setLoadingAp(true)
    try {
      const options = await apService.getApOptions(namaDistributor)
      if (getValues('namaDistributor') !== namaDistributor) return
      setApOptions(options)
      const autoSelectedAp = getAutoSelectedAp(options)
      if (autoSelectedAp) await loadIdentity(namaDistributor, autoSelectedAp)
    } catch (error) {
      setMasterError(error instanceof ApiClientError ? error.message : 'Daftar AP gagal dimuat. Silakan coba kembali.')
      setLookupStatus('error')
    } finally { setLoadingAp(false) }
  }, [getValues, loadIdentity, reset])

  const requestSwitch = (next: PendingSwitch) => {
    if (isDirty && mode) setPendingSwitch(next)
    else if (next.kind === 'distributor') void applyDistributor(next.value)
    else void loadIdentity(getValues('namaDistributor'), next.value)
  }
  const selectDistributor = (value: string) => {
    if (value !== getValues('namaDistributor')) requestSwitch({ kind: 'distributor', value })
  }
  const selectAp = (value: string) => {
    if (value !== getValues('ap')) requestSwitch({ kind: 'ap', value })
  }
  const retryCurrentLoad = () => {
    const namaDistributor = getValues('namaDistributor')
    const ap = getValues('ap')
    if (namaDistributor && ap) void loadIdentity(namaDistributor, ap)
    else if (namaDistributor) void applyDistributor(namaDistributor)
    else void loadMasters()
  }

  const onSubmit = async (values: SupervisorFormValues) => {
    if (processingRef.current || !mode) return
    processingRef.current = true; setSubmissionError(undefined); setEditSuccess(undefined)
    const requestToken = createRequestToken(); const uploadedFileIds: string[] = []; let persistenceSucceeded = false
    try {
      const normalized = normalizeSubmission(values)
      const supervisors: SubmissionRequest['supervisors'] = []
      for (const supervisor of normalized.supervisors) {
        if (supervisor.source === 'baseline') {
          supervisors.push({ supervisorId: supervisor.supervisorId, idMdxl: supervisor.idMdxl, source: 'baseline', namaSupervisor: supervisor.namaSupervisor, ktp: { kind: 'not-required' } })
        } else if (supervisor.ktp?.kind === 'existing') {
          supervisors.push({ supervisorId: supervisor.supervisorId, source: 'custom', namaSupervisor: supervisor.namaSupervisor, ktp: { kind: 'existing' } })
        } else if (supervisor.ktp?.kind === 'new') {
          setProcessingStatus({ stage: 'upload', supervisorNo: supervisor.supervisorNo, fileName: supervisor.ktp.file.name, progress: 0 })
          const uploaded = await uploadService.uploadKtp({ requestToken, namaDistributor: normalized.namaDistributor, ap: normalized.ap, supervisorNo: supervisor.supervisorNo, namaSupervisor: supervisor.namaSupervisor, file: supervisor.ktp.file },
            (progress) => setProcessingStatus((current) => current?.stage === 'upload' ? { ...current, progress } : current),
            (fileId) => uploadedFileIds.push(fileId))
          supervisors.push({ supervisorId: supervisor.supervisorId, source: 'custom', namaSupervisor: supervisor.namaSupervisor, ktp: { kind: 'new', ...uploaded } })
        } else throw new Error('Missing validated KTP')
      }
      const payload: SubmissionRequest = { requestToken, namaDistributor: normalized.namaDistributor, ap: normalized.ap, submissionAreaId: normalized.submissionAreaId, supervisors }
      setProcessingStatus({ stage: 'persistence' })
      const result = mode.kind === 'edit' ? await submissionService.update(mode.submissionId, payload) : await submissionService.create(payload)
      persistenceSucceeded = true
      if (mode.kind === 'edit') {
        const refreshed = await submissionService.findByDistributorAp(normalized.namaDistributor, normalized.ap)
        if (!refreshed.exists) throw new Error('Saved submission could not be reloaded')
        reset(storedToForm(refreshed.submission)); setMode({ kind: 'edit', submissionId: refreshed.submission.submissionId }); setLookupStatus('edit'); setEditSuccess(result)
      } else setSuccessResult(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (!persistenceSucceeded) { try { await uploadService.cleanup(requestToken, uploadedFileIds) } catch { /* safe best effort */ } }
      setSubmissionError(persistenceSucceeded ? 'Data berhasil disimpan, tetapi tampilan gagal dimuat ulang. Muat ulang halaman.' : error instanceof ApiClientError ? error.message : 'Data gagal diproses. Submission sebelumnya tetap aman.')
    } finally { processingRef.current = false; setProcessingStatus(undefined) }
  }

  const startNewForm = () => { reset(createDefaultFormValues()); setApOptions([]); setMode(undefined); setLookupStatus('idle'); setSuccessResult(undefined); setEditSuccess(undefined); setSubmissionError(undefined) }
  const ready = mode !== undefined && lookupStatus !== 'loading'
  return (
    <FormShell title='PILOK - Supervisor' subtitle='Pendataan Supervisor berdasarkan Distributor dan AP.'>
      {successResult ? <SectionCard className='mx-auto max-w-2xl py-10 text-center sm:py-12'>
        <span className='success-icon'><CheckIcon className='size-7' /></span><h2 className='mt-4 text-2xl font-bold'>Data Supervisor berhasil disimpan.</h2>
        <p className='mt-2 text-sm text-slate-600'>Submission ID</p><p className='mt-1 font-mono font-semibold text-slate-800'>{successResult.submissionId}</p>
        <button type='button' className='button-primary mt-6' onClick={startNewForm}>Isi Form Baru</button>
      </SectionCard> : <FormProvider {...methods}><form ref={formRef} className='space-y-6' noValidate onSubmit={handleSubmit(onSubmit, () => window.requestAnimationFrame(() => { if (formRef.current) focusFirstInvalidField(formRef.current) }))}>
        <DistributorSection distributors={distributors} apOptions={apOptions} isLoading={loadingMaster} isLoadingAp={loadingAp} loadError={masterError} lookupStatus={lookupStatus} onSelectDistributor={selectDistributor} onSelectAp={selectAp} onRetry={retryCurrentLoad} />
        {editSuccess && <StatusBanner variant='success' title='Perubahan berhasil disimpan'>Submission ID: <span className='font-mono font-semibold'>{editSuccess.submissionId}</span></StatusBanner>}
        {ready && <SectionCard><SectionHeader step={2} title='Wilayah Operasional' description='Data yang ditampilkan pada menu ini merupakan hasil pengisian data pada periode Q1 2026.' />
          <div className='mt-6'><WilayahCard /></div><FieldError message={typeof errors.supervisors?.message === 'string' ? errors.supervisors.message : undefined} />
        </SectionCard>}
        {ready && <ActionBar feedback={submissionError ? <StatusBanner variant='error' compact>{submissionError}</StatusBanner> : processingStatus?.stage === 'upload' ? <StatusBanner variant='info' compact>Mengunggah KTP Supervisor {processingStatus.supervisorNo}: {processingStatus.progress}%</StatusBanner> : processingStatus?.stage === 'persistence' ? <StatusBanner variant='info' compact>Menyimpan data ke Google Sheets...</StatusBanner> : undefined}>
          <button type='submit' className='button-primary' disabled={isSubmitting || Boolean(processingStatus)}>{isSubmitting ? 'Memproses...' : mode.kind === 'edit' ? 'Simpan Perubahan' : 'Simpan Data'}</button>
        </ActionBar>}
      </form></FormProvider>}
      <ConfirmationDialog open={Boolean(pendingSwitch)} title={pendingSwitch?.kind === 'ap' ? 'Ganti AP?' : 'Ganti Distributor?'} description='Perubahan yang belum disimpan akan dibuang sebelum data lain dimuat.' confirmLabel='Ganti' onCancel={() => setPendingSwitch(undefined)} onConfirm={() => { const next = pendingSwitch; setPendingSwitch(undefined); if (!next) return; if (next.kind === 'distributor') void applyDistributor(next.value); else void loadIdentity(getValues('namaDistributor'), next.value) }} />
    </FormShell>
  )
}

export default App
