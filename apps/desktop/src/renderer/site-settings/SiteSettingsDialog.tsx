import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  BUSINESS_NAME_MAX,
  type ImageMeta,
  isImageMeta,
  MEASUREMENT_ID_MAX,
  type MediaId,
  OPENING_HOURS_NOTE_MAX,
  POSTAL_ADDRESS_MAX,
  SITE_DESCRIPTION_MAX,
  SITE_NAME_MAX,
  type SiteDoc,
  type SiteSettings,
  SOCIAL_NETWORKS,
  X_HANDLE_MAX,
} from "@webforge/model";
import { PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { mediaImageUrl } from "../../shared/ipc/media.js";
import { Check, Field, ImageChoice } from "../site/PageSettingsDialog.js";
import {
  checkSettings,
  DAYS,
  FORM_SERVICES,
  type SettingsForm,
  toSettingsForm,
} from "./settings-form.js";

/** The dialog's sections, in order (F-SET-1); each field's first path part names its section. */
const SECTIONS = [
  "general",
  "address",
  "social",
  "contact",
  "search",
  "analytics",
  "forms",
] as const;
type Section = (typeof SECTIONS)[number];

/** Props of {@link SiteSettingsDialog}. */
export type SiteSettingsDialogProps = {
  readonly open: boolean;
  readonly site: SiteDoc;
  /** Valid settings to save; the dialog has checked them. */
  readonly onSave: (settings: SiteSettings) => void;
  readonly onCancel: () => void;
  /** Where an image's thumbnail is; the `webforge-media:` scheme by default, data URLs in stories. */
  readonly imageUrl?: (item: ImageMeta) => string;
  /** The section shown first; stories show the others. */
  readonly initialSection?: Section;
};

/**
 * Site Settings (F-SET-1, X3): the details that apply to the whole site, in sections. Save checks
 * every value with the model's own schema and points at what needs fixing in plain words; saved
 * settings are one undo step. Publishing destinations are set up when publishing (B1).
 */
export function SiteSettingsDialog(props: SiteSettingsDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onCancel();
      }}
    >
      {/* Mounted with each opening, so the form starts from the saved settings every time. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {props.open ? <SiteSettingsForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Media thumbnails, by default. */
const thumbnailUrl: NonNullable<SiteSettingsDialogProps["imageUrl"]> = (item) =>
  mediaImageUrl(item, "thumbnail");

function SiteSettingsForm({
  site,
  onSave,
  onCancel,
  imageUrl = thumbnailUrl,
  initialSection = "general",
}: SiteSettingsDialogProps) {
  const [form, setForm] = useState<SettingsForm>(() => toSettingsForm(site.settings));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [section, setSection] = useState<Section>(initialSection);
  const images = Object.values(site.media).filter(isImageMeta);
  const change = (next: Partial<SettingsForm>) => setForm((current) => ({ ...current, ...next }));
  const invalid = (field: string, hintId?: string) => errorProps(field, errors, hintId);

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const checked = checkSettings(form, site.settings);
        if (checked.ok) {
          onSave(checked.settings);
          return;
        }
        setErrors(checked.errors);
        // Show the first section with something to fix.
        const first = SECTIONS.find((name) =>
          Object.keys(checked.errors).some((field) => sectionOf(field) === name),
        );
        if (first !== undefined) setSection(first);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("site.settings.title")}</DialogTitle>
        <DialogDescription>{t("site.settings.description")}</DialogDescription>
      </DialogHeader>

      <Tabs
        value={section}
        onValueChange={(value) => setSection(SECTIONS.find((name) => name === value) ?? section)}
      >
        <TabsList
          aria-label={t("site.settings.sections")}
          // Seven sections wrap onto a second row in a narrow window; each row keeps the tabs' height.
          className="h-auto flex-wrap [&>*]:h-8"
        >
          {SECTIONS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`site.settings.section.${name}`)}
              {Object.keys(errors).some((field) => sectionOf(field) === name) ? (
                <span aria-hidden className="ml-1 size-1.5 rounded-full bg-destructive" />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="grid gap-3 pt-3">
          <Field label={t("site.settings.name")}>
            {({ id }) => (
              <>
                <input
                  id={id}
                  className={fieldControlClass}
                  value={form.name}
                  maxLength={SITE_NAME_MAX}
                  onChange={(event) => change({ name: event.currentTarget.value })}
                  {...invalid("general.name")}
                />
                <ErrorText field="general.name" errors={errors} />
              </>
            )}
          </Field>
          <Field
            label={t("site.settings.siteDescription")}
            hint={t("site.settings.siteDescriptionHint")}
          >
            {({ id, hintId }) => (
              <textarea
                id={id}
                className={cn(fieldControlClass, "h-16 resize-none py-1")}
                value={form.description}
                maxLength={SITE_DESCRIPTION_MAX}
                onChange={(event) => change({ description: event.currentTarget.value })}
                {...invalid("general.description", hintId)}
              />
            )}
          </Field>
          <Field label={t("site.settings.language")} hint={t("site.settings.languageHint")}>
            {({ id, hintId }) => (
              <>
                <input
                  id={id}
                  className={cn(fieldControlClass, "w-32")}
                  value={form.language}
                  maxLength={35}
                  onChange={(event) => change({ language: event.currentTarget.value })}
                  {...invalid("general.language", hintId)}
                />
                <ErrorText field="general.language" errors={errors} />
              </>
            )}
          </Field>
          <ImagePicker
            name="site-icon"
            legend={t("site.settings.icon")}
            hint={t("site.settings.iconHint")}
            images={images}
            imageUrl={imageUrl}
            value={form.icon}
            onChange={(icon) => change({ icon })}
          />
        </TabsContent>

        <TabsContent value="address" className="grid gap-3 pt-3">
          <Field label={t("site.settings.webAddress")} hint={t("site.settings.webAddressHint")}>
            {({ id, hintId }) => (
              <>
                <input
                  id={id}
                  type="url"
                  inputMode="url"
                  className={fieldControlClass}
                  placeholder={t("site.settings.webAddressPlaceholder")}
                  value={form.url}
                  onChange={(event) => change({ url: event.currentTarget.value })}
                  {...invalid("address.url", hintId)}
                />
                <ErrorText field="address.url" errors={errors} />
              </>
            )}
          </Field>
        </TabsContent>

        <TabsContent value="social" className="grid gap-3 pt-3">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs text-muted-foreground">
              {t("site.settings.profiles")}
            </legend>
            {form.profiles.map((profile, index) => {
              const field = `social.profiles.${index}.url`;
              const replace = (next: Partial<(typeof form.profiles)[number]>) =>
                change({
                  profiles: form.profiles.map((other, at) =>
                    at === index ? { ...other, ...next } : other,
                  ),
                });
              return (
                // Rows have no ids of their own; their inputs are controlled, so keys by position
                // are enough.
                <div key={index} className="grid gap-1">
                  <div className="flex gap-1.5">
                    <select
                      aria-label={t("site.settings.network")}
                      className={cn(fieldControlClass, "w-32")}
                      value={profile.network}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        const network = SOCIAL_NETWORKS.find((name) => name === value);
                        if (network !== undefined) replace({ network });
                      }}
                    >
                      {SOCIAL_NETWORKS.map((network) => (
                        <option key={network} value={network}>
                          {t(`site.settings.network.${network}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={t("site.settings.profileUrl")}
                      type="url"
                      inputMode="url"
                      className={fieldControlClass}
                      placeholder="https://"
                      value={profile.url}
                      onChange={(event) => replace({ url: event.currentTarget.value })}
                      {...invalid(field)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("site.settings.removeProfile")}
                      title={t("site.settings.removeProfile")}
                      onClick={() =>
                        change({ profiles: form.profiles.filter((_, at) => at !== index) })
                      }
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <ErrorText field={field} errors={errors} />
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                change({ profiles: [...form.profiles, { network: "facebook", url: "" }] })
              }
            >
              <PlusIcon />
              {t("site.settings.addProfile")}
            </Button>
          </fieldset>
          <ImagePicker
            name="site-share-image"
            legend={t("site.settings.shareImage")}
            hint={t("site.settings.shareImageHint")}
            images={images}
            imageUrl={imageUrl}
            value={form.shareImage}
            onChange={(shareImage) => change({ shareImage })}
          />
          <Field label={t("site.settings.xHandle")}>
            {({ id }) => (
              <>
                <input
                  id={id}
                  className={cn(fieldControlClass, "w-48")}
                  placeholder="@"
                  value={form.xHandle}
                  maxLength={X_HANDLE_MAX}
                  onChange={(event) => change({ xHandle: event.currentTarget.value })}
                  {...invalid("social.xHandle")}
                />
                <ErrorText field="social.xHandle" errors={errors} />
              </>
            )}
          </Field>
        </TabsContent>

        <TabsContent value="contact" className="grid gap-3 pt-3">
          <TextInput
            label={t("site.settings.businessName")}
            field="contact.businessName"
            value={form.businessName}
            maxLength={BUSINESS_NAME_MAX}
            errors={errors}
            onChange={(businessName) => change({ businessName })}
          />
          <TextInput
            label={t("site.settings.email")}
            field="contact.email"
            type="email"
            value={form.email}
            errors={errors}
            onChange={(email) => change({ email })}
          />
          <TextInput
            label={t("site.settings.phone")}
            field="contact.phone"
            type="tel"
            value={form.phone}
            errors={errors}
            onChange={(phone) => change({ phone })}
          />
          <Field label={t("site.settings.address")}>
            {({ id }) => (
              <textarea
                id={id}
                className={cn(fieldControlClass, "h-16 resize-none py-1")}
                value={form.address}
                maxLength={POSTAL_ADDRESS_MAX}
                onChange={(event) => change({ address: event.currentTarget.value })}
                {...invalid("contact.address")}
              />
            )}
          </Field>
          <OpeningHours form={form} errors={errors} invalid={invalid} change={change} />
          <TextInput
            label={t("site.settings.openingHoursNote")}
            hint={t("site.settings.openingHoursNoteHint")}
            field="contact.openingHoursNote"
            value={form.openingHoursNote}
            maxLength={OPENING_HOURS_NOTE_MAX}
            errors={errors}
            onChange={(openingHoursNote) => change({ openingHoursNote })}
          />
        </TabsContent>

        <TabsContent value="search" className="grid gap-2 pt-3">
          <Check
            label={t("site.settings.allowIndexing")}
            checked={form.allowIndexing}
            onChange={(allowIndexing) => change({ allowIndexing })}
          />
          <Check
            label={t("site.settings.includeSitemap")}
            checked={form.includeSitemap}
            onChange={(includeSitemap) => change({ includeSitemap })}
          />
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-3 pt-3">
          <TextInput
            label={t("site.settings.measurementId")}
            hint={t("site.settings.measurementIdHint")}
            field="analytics.measurementId"
            value={form.measurementId}
            maxLength={MEASUREMENT_ID_MAX}
            errors={errors}
            onChange={(measurementId) => change({ measurementId })}
          />
          <Check
            label={t("site.settings.consentBanner")}
            checked={form.consentBanner}
            onChange={(consentBanner) => change({ consentBanner })}
          />
        </TabsContent>

        <TabsContent value="forms" className="grid gap-3 pt-3">
          <Field label={t("site.settings.formService")} hint={t("site.settings.formServiceHint")}>
            {({ id, hintId }) => (
              <select
                id={id}
                className={cn(fieldControlClass, "w-48")}
                value={form.formService}
                aria-describedby={hintId}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  const formService = FORM_SERVICES.find((service) => service === value);
                  if (formService !== undefined) change({ formService, formValue: "" });
                }}
              >
                {FORM_SERVICES.map((service) => (
                  <option key={service} value={service}>
                    {t(`site.settings.formService.${service === "" ? "none" : service}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {form.formService === "" || form.formService === "netlify" ? null : (
            <TextInput
              label={t(`site.settings.formValue.${form.formService}`)}
              field="forms.value"
              type={
                form.formService === "formsubmit"
                  ? "email"
                  : form.formService === "custom"
                    ? "url"
                    : "text"
              }
              value={form.formValue}
              errors={errors}
              onChange={(formValue) => change({ formValue })}
            />
          )}
        </TabsContent>
      </Tabs>

      {Object.keys(errors).length === 0 ? null : (
        <p role="alert" className="m-0 text-xs text-destructive">
          {t("site.settings.fixErrors")}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("site.settings.cancel")}
        </Button>
        <Button type="submit">{t("site.settings.save")}</Button>
      </DialogFooter>
    </form>
  );
}

/**
 * What an input needs to show a field's error: `aria-invalid`, and `aria-describedby` pointing at
 * its hint and its message.
 */
function errorProps(field: string, errors: Readonly<Record<string, string>>, hintId?: string) {
  const error = errors[field];
  const describedBy = [hintId, error === undefined ? undefined : `error-${field}`].filter(
    (id) => id !== undefined,
  );
  return {
    "aria-invalid": error === undefined ? undefined : true,
    "aria-describedby": describedBy.length === 0 ? undefined : describedBy.join(" "),
  } as const;
}

/** The section a field is in: the first part of its path. */
function sectionOf(field: string): string {
  return field.split(".")[0] ?? "";
}

/** A field's message, if Save found something to fix there. */
function ErrorText({
  field,
  errors,
}: {
  readonly field: string;
  readonly errors: Readonly<Record<string, string>>;
}) {
  const message = errors[field];
  return message === undefined ? null : (
    <p id={`error-${field}`} className="m-0 text-xs text-destructive">
      {message}
    </p>
  );
}

/** A labelled one-line input with its hint and error. */
function TextInput({
  label,
  hint,
  field,
  type = "text",
  value,
  maxLength,
  errors,
  onChange,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly field: string;
  readonly type?: "text" | "email" | "tel" | "url";
  readonly value: string;
  readonly maxLength?: number;
  readonly errors: Readonly<Record<string, string>>;
  readonly onChange: (value: string) => void;
}) {
  return (
    <Field label={label} {...(hint === undefined ? {} : { hint })}>
      {({ id, hintId }) => (
        <>
          <input
            id={id}
            type={type}
            className={fieldControlClass}
            value={value}
            {...(maxLength === undefined ? {} : { maxLength })}
            {...errorProps(field, errors, hintId)}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <ErrorText field={field} errors={errors} />
        </>
      )}
    </Field>
  );
}

/** A choice of one of Media's images, or none. */
function ImagePicker({
  name,
  legend,
  hint,
  images,
  imageUrl,
  value,
  onChange,
}: {
  readonly name: string;
  readonly legend: string;
  readonly hint: string;
  readonly images: readonly ImageMeta[];
  readonly imageUrl: (item: ImageMeta) => string;
  readonly value: MediaId | undefined;
  readonly onChange: (value: MediaId | undefined) => void;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-xs text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        <ImageChoice
          name={name}
          label={t("site.settings.noImage")}
          selected={value === undefined}
          onSelect={() => onChange(undefined)}
        />
        {images.map((image) => (
          <ImageChoice
            key={image.id}
            name={name}
            label={image.fileName}
            thumbnail={imageUrl(image)}
            selected={value === image.id}
            onSelect={() => onChange(image.id)}
          />
        ))}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {images.length === 0 ? t("site.settings.noImages") : hint}
      </p>
    </fieldset>
  );
}

/** Opening hours: rows of days and times, added and removed freely. */
function OpeningHours({
  form,
  errors,
  invalid,
  change,
}: {
  readonly form: SettingsForm;
  readonly errors: Readonly<Record<string, string>>;
  readonly invalid: (field: string) => Record<string, unknown>;
  readonly change: (next: Partial<SettingsForm>) => void;
}) {
  const replace = (index: number, next: Partial<SettingsForm["openingHours"][number]>) =>
    change({
      openingHours: form.openingHours.map((hours, at) =>
        at === index ? { ...hours, ...next } : hours,
      ),
    });
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-xs text-muted-foreground">
        {t("site.settings.openingHours")}
      </legend>
      {form.openingHours.map((hours, index) => {
        const field = `contact.openingHours.${index}`;
        return (
          <div key={index} className="grid gap-1 rounded-sm border border-border p-2">
            <fieldset className="flex flex-wrap items-center gap-1" {...invalid(`${field}.days`)}>
              <legend className="sr-only">{t("site.settings.days")}</legend>
              {DAYS.map((day) => (
                <label
                  key={day}
                  className={cn(
                    "flex h-7 cursor-pointer items-center rounded-sm border border-border px-2 text-xs",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    hours.days.includes(day) && "border-primary bg-accent text-accent-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={hours.days.includes(day)}
                    onChange={(event) =>
                      replace(index, {
                        days: event.currentTarget.checked
                          ? [...hours.days, day]
                          : hours.days.filter((other) => other !== day),
                      })
                    }
                  />
                  {t(`site.settings.day.${day}`)}
                </label>
              ))}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-auto"
                aria-label={t("site.settings.removeHours")}
                title={t("site.settings.removeHours")}
                onClick={() =>
                  change({ openingHours: form.openingHours.filter((_, at) => at !== index) })
                }
              >
                <XIcon />
              </Button>
            </fieldset>
            <ErrorText field={`${field}.days`} errors={errors} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <TimeInput
                label={t("site.settings.opens")}
                value={hours.opens}
                field={`${field}.opens`}
                errors={errors}
                onChange={(opens) => replace(index, { opens })}
              />
              <TimeInput
                label={t("site.settings.closes")}
                value={hours.closes}
                field={`${field}.closes`}
                errors={errors}
                onChange={(closes) => replace(index, { closes })}
              />
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={() =>
          change({
            openingHours: [...form.openingHours, { days: [], opens: "09:00", closes: "17:00" }],
          })
        }
      >
        <PlusIcon />
        {t("site.settings.addHours")}
      </Button>
    </fieldset>
  );
}

/** One time of opening hours, `HH:MM`. */
function TimeInput({
  label,
  value,
  field,
  errors,
  onChange,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly field: string;
  readonly errors: Readonly<Record<string, string>>;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {label}
        <input
          type="time"
          // Wide enough for a 12-hour clock ("07:00 AM") as well as a 24-hour one.
          className={cn(fieldControlClass, "w-32")}
          value={value}
          {...errorProps(field, errors)}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </span>
      <ErrorText field={field} errors={errors} />
    </label>
  );
}
