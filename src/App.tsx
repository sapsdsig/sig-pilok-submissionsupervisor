import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useFieldArray, useForm } from 'react-hook-form'
import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DistributorSection } from './components/DistributorSection'
import { FieldError } from './components/FieldError'
import {
  ActionBar,
  FormShell,
  SectionCard,
  SectionHeader,
  StatusBanner,
} from './components/FormLayout'
import { CheckIcon } from './components/icons'
import { WilayahCard } from './components/WilayahCard'
import { createSupervisorFormSchema } from './schemas/supervisorFormSchema'
import { ApiClientError } from './services/apiClient'
import { distributorService } from './services/distributorService'
import { regionService } from './services/regionService'
import { submissionService } from './services/submissionService'
import { uploadService } from './services/uploadService'
import type {
  StoredSubmission,
  SubmissionRequest,
  SubmissionResult,
} from './types/api'
import {
  createDefaultFormValues,
  createEmptyWilayah,
  type SupervisorFormValues,
  type WilayahEntry,
} from './types/form'
import type { Distributor, ProvinceOption } from './types/masterData'
import { normalizeSubmission } from './utils/submission'
import { createRequestToken } from './utils/requestToken'
import { focusFirstInvalidField } from './utils/formFocus'

type FormMode =
  | { kind: 'create' }
  | { kind: 'edit'; submissionId: string }

type LookupStatus = 'idle' | 'loading' | 'create' | 'edit' | 'error'

type ProcessingStatus =
  | {
      stage: 'upload'
      wilayahNo: number
      supervisorNo: number
      fileName: string
      progress: number
    }
  | { stage: 'persistence' }

const isWilayahPopulated = (wilayah: WilayahEntry) =>
  Boolean(
    wilayah.submissionAreaId ||
      wilayah.provinsiName ||
      wilayah.areaName ||
      wilayah.supervisors.some(
        (supervisor) =>
          supervisor.supervisorId ||
          supervisor.namaSupervisor.trim() ||
          supervisor.ktp,
      ),
  )

const storedToForm = (stored: StoredSubmission): SupervisorFormValues => ({
  namaDistributor: stored.namaDistributor,
  wilayah: stored.wilayah.map((area) => ({
    submissionAreaId: area.submissionAreaId,
    provinsiName: area.provinsiName,
    areaName: area.areaName,
    supervisors: area.supervisors.map((supervisor) => ({
      supervisorId: supervisor.supervisorId,
      namaSupervisor: supervisor.namaSupervisor,
      ktp: { kind: 'existing' as const, ...supervisor.ktp },
    })),
  })),
})

function App() {
  const schema = useMemo(
    () =>
      createSupervisorFormSchema({
        isKnownDistributor: (name) =>
          distributorService.isKnownDistributor(name),
        getProvince: (name) => regionService.getProvince(name),
        getArea: (province, area) => regionService.getArea(province, area),
      }),
    [],
  )
  const methods = useForm<SupervisorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: createDefaultFormValues(),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = methods
  const wilayahArray = useFieldArray({ control, name: 'wilayah' })
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [masterError, setMasterError] = useState<string>()
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [mode, setMode] = useState<FormMode>()
  const [pendingDistributor, setPendingDistributor] = useState<string>()
  const [pendingWilayah, setPendingWilayah] = useState<number | null>(null)
  const [submissionError, setSubmissionError] = useState<string>()
  const [successResult, setSuccessResult] = useState<SubmissionResult>()
  const [editSuccess, setEditSuccess] = useState<SubmissionResult>()
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>()
  const processingRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  const loadMasters = useCallback(async () => {
    setLoadingMaster(true)
    setMasterError(undefined)
    try {
      const [loadedDistributors, loadedProvinces] = await Promise.all([
        distributorService.getDistributors(),
        regionService.getProvinces(),
      ])
      setDistributors(loadedDistributors)
      setProvinces(loadedProvinces)
    } catch (error) {
      setDistributors([])
      setProvinces([])
      setMasterError(
        error instanceof ApiClientError
          ? error.message
          : 'Master data gagal dimuat. Silakan coba kembali.',
      )
    } finally {
      setLoadingMaster(false)
    }
  }, [])

  useEffect(() => {
    void loadMasters()
  }, [loadMasters])

  const loadDistributorSubmission = useCallback(
    async (namaDistributor: string) => {
      setLookupStatus('loading')
      setMode(undefined)
      setSubmissionError(undefined)
      setEditSuccess(undefined)
      reset({
        ...createDefaultFormValues(),
        namaDistributor,
      })
      try {
        const result =
          await submissionService.findByDistributor(namaDistributor)
        if (getValues('namaDistributor') !== namaDistributor) return
        if (result.exists) {
          reset(storedToForm(result.submission))
          setMode({
            kind: 'edit',
            submissionId: result.submission.submissionId,
          })
          setLookupStatus('edit')
        } else {
          reset({
            ...createDefaultFormValues(),
            namaDistributor,
          })
          setMode({ kind: 'create' })
          setLookupStatus('create')
        }
      } catch (error) {
        if (getValues('namaDistributor') !== namaDistributor) return
        setMode(undefined)
        setLookupStatus('error')
        setError('namaDistributor', {
          type: 'manual',
          message:
            error instanceof ApiClientError
              ? error.message
              : 'Pemeriksaan data tersimpan gagal. Coba kembali.',
        })
      }
    },
    [getValues, reset, setError],
  )

  const selectDistributor = (name: string) => {
    if (!name || name === getValues('namaDistributor')) return
    if (getValues('namaDistributor') && isDirty && mode) {
      setPendingDistributor(name)
      return
    }
    void loadDistributorSubmission(name)
  }

  const requestWilayahRemoval = (index: number) => {
    if (wilayahArray.fields.length <= 1) return
    if (isWilayahPopulated(getValues(`wilayah.${index}`))) {
      setPendingWilayah(index)
    } else {
      wilayahArray.remove(index)
    }
  }

  const onSubmit = async (values: SupervisorFormValues) => {
    if (processingRef.current || !mode) return
    processingRef.current = true
    setSubmissionError(undefined)
    setEditSuccess(undefined)
    const requestToken = createRequestToken()
    const uploadedFileIds: string[] = []
    let persistenceSucceeded = false
    try {
      const normalized = normalizeSubmission(values)
      const wilayah: SubmissionRequest['wilayah'] = []
      for (const [areaIndex, area] of normalized.wilayah.entries()) {
        const supervisors: SubmissionRequest['wilayah'][number]['supervisors'] = []
        for (const supervisor of area.supervisors) {
          if (!supervisor.ktp) throw new Error('Missing validated KTP')
          if (supervisor.ktp.kind === 'existing') {
            supervisors.push({
              supervisorId: supervisor.supervisorId,
              namaSupervisor: supervisor.namaSupervisor,
              ktp: {
                kind: 'existing',
                fileId: supervisor.ktp.fileId,
              },
            })
            continue
          }
          setProcessingStatus({
            stage: 'upload',
            wilayahNo: areaIndex + 1,
            supervisorNo: supervisor.supervisorNo,
            fileName: supervisor.ktp.file.name,
            progress: 0,
          })
          const uploaded = await uploadService.uploadKtp(
            {
              requestToken,
              namaDistributor: normalized.namaDistributor,
              provinsiName: area.provinsiName,
              areaName: area.areaName,
              supervisorNo: supervisor.supervisorNo,
              namaSupervisor: supervisor.namaSupervisor,
              file: supervisor.ktp.file,
            },
            (progress) =>
              setProcessingStatus((current) =>
                current?.stage === 'upload'
                  ? { ...current, progress }
                  : current,
              ),
            (fileId) => uploadedFileIds.push(fileId),
          )
          supervisors.push({
            supervisorId: supervisor.supervisorId,
            namaSupervisor: supervisor.namaSupervisor,
            ktp: { kind: 'new', ...uploaded },
          })
        }
        wilayah.push({
          submissionAreaId: area.submissionAreaId,
          provinsiName: area.provinsiName,
          areaName: area.areaName,
          supervisors,
        })
      }

      const payload: SubmissionRequest = {
        requestToken,
        namaDistributor: normalized.namaDistributor,
        wilayah,
      }
      setProcessingStatus({ stage: 'persistence' })
      const result =
        mode.kind === 'edit'
          ? await submissionService.update(mode.submissionId, payload)
          : await submissionService.create(payload)
      persistenceSucceeded = true

      if (mode.kind === 'edit') {
        const refreshed = await submissionService.findByDistributor(
          normalized.namaDistributor,
        )
        if (!refreshed.exists) {
          throw new Error('Saved submission could not be reloaded')
        }
        reset(storedToForm(refreshed.submission))
        setMode({
          kind: 'edit',
          submissionId: refreshed.submission.submissionId,
        })
        setLookupStatus('edit')
        setEditSuccess(result)
      } else {
        setSuccessResult(result)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (!persistenceSucceeded) {
        try {
          await uploadService.cleanup(requestToken, uploadedFileIds)
        } catch {
          // Server-side reference checks make this best effort and safe.
        }
      }
      setSubmissionError(
        persistenceSucceeded
          ? 'Data berhasil disimpan, tetapi tampilan gagal dimuat ulang. Muat ulang halaman.'
          : error instanceof ApiClientError
            ? error.message
            : 'Data gagal diproses. Submission sebelumnya tetap aman.',
      )
    } finally {
      processingRef.current = false
      setProcessingStatus(undefined)
    }
  }

  const startNewForm = () => {
    reset(createDefaultFormValues())
    setMode(undefined)
    setLookupStatus('idle')
    setSuccessResult(undefined)
    setEditSuccess(undefined)
    setSubmissionError(undefined)
  }

  const ready = mode !== undefined && lookupStatus !== 'loading'
  const onInvalidSubmit = () => {
    window.requestAnimationFrame(() => {
      if (formRef.current) focusFirstInvalidField(formRef.current)
    })
  }

  return (
    <FormShell
      title='PILOK - Supervisor'
      subtitle='Form pendataan Supervisor Distributor dan wilayah operasional.'
    >
      {successResult ? (
        <SectionCard className='mx-auto max-w-2xl py-10 text-center sm:py-12'>
          <span className='success-icon'>
            <CheckIcon className='size-7' />
          </span>
          <h2 className='mt-4 text-2xl font-bold'>
            Data Supervisor berhasil disimpan.
          </h2>
          <p className='mt-2 text-sm text-slate-600'>Submission ID</p>
          <p className='mt-1 font-mono font-semibold text-slate-800'>
            {successResult.submissionId}
          </p>
          <button
            type='button'
            className='button-primary mt-6'
            onClick={startNewForm}
          >
            Isi Form Baru
          </button>
        </SectionCard>
      ) : (
        <FormProvider {...methods}>
          <form
            ref={formRef}
            className='space-y-6'
            noValidate
            onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}
          >
              <DistributorSection
                distributors={distributors}
                isLoading={loadingMaster}
                loadError={masterError}
                lookupStatus={lookupStatus}
                onSelect={selectDistributor}
                onRetry={() => void loadMasters()}
              />

              {editSuccess && (
                <StatusBanner variant='success' title='Perubahan berhasil disimpan'>
                  Submission ID: <span className='font-mono font-semibold'>{editSuccess.submissionId}</span>
                </StatusBanner>
              )}

              {ready && (
                <SectionCard>
                  <SectionHeader
                    step={2}
                    title='Wilayah Operasional'
                    description='Setiap kartu mewakili satu Provinsi dan Area.'
                  />
                  <div className='mt-6 space-y-5'>
                    {wilayahArray.fields.map((field, index) => (
                      <WilayahCard
                        key={field.id}
                        index={index}
                        provinces={provinces}
                        regionService={regionService}
                        canRemove={wilayahArray.fields.length > 1}
                        onRemove={() => requestWilayahRemoval(index)}
                      />
                    ))}
                  </div>
                  <FieldError message={typeof errors.wilayah?.message === 'string' ? errors.wilayah.message : undefined} />
                  <button type='button' className='button-secondary mt-5' onClick={() => wilayahArray.append(createEmptyWilayah())}>
                    + Tambah Wilayah
                  </button>
                </SectionCard>
              )}

              {ready && (
                <ActionBar
                  feedback={
                    submissionError ? (
                      <StatusBanner variant='error' compact>
                        {submissionError}
                      </StatusBanner>
                    ) : processingStatus?.stage === 'upload' ? (
                      <StatusBanner variant='info' compact>
                        Mengunggah KTP Supervisor {processingStatus.supervisorNo}, Wilayah {processingStatus.wilayahNo}: {processingStatus.progress}%
                      </StatusBanner>
                    ) : processingStatus?.stage === 'persistence' ? (
                      <StatusBanner variant='info' compact>
                        Menyimpan data ke Google Sheets...
                      </StatusBanner>
                    ) : undefined
                  }
                >
                  <button
                    type='submit'
                    className='button-primary'
                    disabled={isSubmitting || Boolean(processingStatus)}
                  >
                    {isSubmitting
                      ? 'Memproses...'
                      : mode.kind === 'edit'
                        ? 'Simpan Perubahan'
                        : 'Simpan Data'}
                  </button>
                </ActionBar>
              )}
          </form>
        </FormProvider>
      )}

      <ConfirmationDialog
        open={pendingWilayah !== null}
        title='Hapus Wilayah?'
        description='Wilayah dan seluruh Supervisor akan dihapus setelah perubahan berhasil disimpan.'
        onCancel={() => setPendingWilayah(null)}
        onConfirm={() => {
          if (pendingWilayah !== null) wilayahArray.remove(pendingWilayah)
          setPendingWilayah(null)
        }}
      />
      <ConfirmationDialog
        open={Boolean(pendingDistributor)}
        title='Ganti Distributor?'
        description='Perubahan yang belum disimpan akan dibuang sebelum data Distributor lain dimuat.'
        confirmLabel='Ganti Distributor'
        onCancel={() => setPendingDistributor(undefined)}
        onConfirm={() => {
          const next = pendingDistributor
          setPendingDistributor(undefined)
          if (next) void loadDistributorSubmission(next)
        }}
      />
    </FormShell>
  )
}

export default App
