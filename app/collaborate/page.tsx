"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./collaborate.module.css";
import { submitCollaboration, fetchFaqs, FAQItem } from "../services/api";

const CITIES = [
  "Ahmedabad",
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Surat",
  "Vadodara",
  "Pune",
  "Jaipur",
  "Other",
];

const ROLES = [
  "Architect",
  "Interior Designer",
  "Lighting Designer",
  "Student",
  "Other",
];

export default function CollaboratePage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | string | null>(null);
  const [hasMadeBefore, setHasMadeBefore] = useState<"no" | "yes">("no");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch dynamic FAQs on mount (Pure Dynamic from DB)
  useEffect(() => {
    fetchFaqs("collaborate")
      .then((data) => {
        if (data && data.length > 0) {
          setFaqs(data);
          setActiveFaq(data[0]._id || data[0].id || null);
        } else {
          setFaqs([]);
        }
      })
      .catch((err) => {
        console.error("Failed to load FAQs:", err);
        setFaqs([]);
      })
      .finally(() => {
        setFaqsLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setIsCityOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setIsRoleOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto scroll to hash section when navigating with #submission-form
  useEffect(() => {
    const scrollToHash = () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (hash) {
        const id = hash.replace("#", "");
        const triggerScroll = () => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        };
        triggerScroll();
        const t1 = setTimeout(triggerScroll, 80);
        const t2 = setTimeout(triggerScroll, 250);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    };

    const cleanup = scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

  const [formFields, setFormFields] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    role: "",
    studioOrCollege: "",
    designDescription: "",
  });

  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    file?: string;
    terms?: string;
  }>({});

  const toggleFaq = (id: number | string) => {
    setActiveFaq((prev) => (prev === id ? null : id));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormFields((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (errorMessage) setErrorMessage("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFormErrors((prev) => ({ ...prev, file: undefined }));
      if (errorMessage) setErrorMessage("");
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setFormErrors((prev) => ({ ...prev, file: undefined }));
      if (errorMessage) setErrorMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: {
      fullName?: string;
      email?: string;
      phone?: string;
      file?: string;
      terms?: string;
    } = {};

    if (!formFields.fullName.trim()) {
      errors.fullName = "Please enter your full name";
    }

    const emailTrimmed = formFields.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrimmed) {
      errors.email = "Email address is compulsory";
    } else if (!emailRegex.test(emailTrimmed)) {
      errors.email = "Please enter a valid email address (e.g. name@example.com)";
    }

    if (!formFields.phone.trim()) {
      errors.phone = "Please enter your phone number";
    }

    if (!selectedFile) {
      errors.file = "Uploading your design (Image or PDF) is compulsory";
    }

    if (!agreedTerms) {
      errors.terms = "Please agree to the submission terms to proceed.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setErrorMessage("Please complete all compulsory fields (* marked) to submit.");
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("name", formFields.fullName);
      formData.append("email", formFields.email);
      if (formFields.phone) formData.append("phone", formFields.phone);
      if (formFields.city) formData.append("city", formFields.city);
      if (formFields.role) formData.append("role", formFields.role);
      if (formFields.studioOrCollege) formData.append("studio_or_college", formFields.studioOrCollege);
      formData.append("has_made_before", hasMadeBefore);
      formData.append(
        "concept_title",
        formFields.designDescription
          ? formFields.designDescription.slice(0, 60)
          : "Lighting Design Submission"
      );
      if (formFields.designDescription) formData.append("description", formFields.designDescription);
      formData.append("source", "collaborate_page");
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      await submitCollaboration(formData);
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit your design. Please check your details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setSelectedFile(null);
    setAgreedTerms(false);
    setIsCityOpen(false);
    setIsRoleOpen(false);
    setHasMadeBefore("no");
    setErrorMessage("");
    setFormErrors({});
    setFormFields({
      fullName: "",
      email: "",
      phone: "",
      city: "",
      role: "",
      studioOrCollege: "",
      designDescription: "",
    });
  };

  return (
    <main className={styles.page}>
      {/* ──────────────────────────────────────────────────────────────────
          1. HERO SECTION
          ────────────────────────────────────────────────────────────────── */}
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <span className={styles.heroTagline}>Deluzex designer programme</span>
            <h1 className={styles.heroTitle}>
              Let your next light<br />carry your name
            </h1>
            <p className={styles.heroDesc}>
              Share Your Lighting Design With Deluzex. If Selected, We’ll Manufacture It In Gujarat,
              Sell It With Your Name And Pay You A Royalty On Every Sale (For As Long As It Sells).
            </p>
            <div className={styles.heroBtns}>
              <a
                href="#submission-form"
                className={styles.btnPrimary}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("submission-form");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    window.history.pushState(null, "", "#submission-form");
                  }
                }}
              >
                Submit your design
              </a>
            </div>
          </div>

          <div className={styles.heroTriptych}>
            <div className={styles.triptychLeftCol}>
              <div className={styles.triptychSmallBox}>
                <Image
                  src="/images/collaborate_sketch.jpg"
                  alt="Architectural lighting sketches and measurements"
                  fill
                  sizes="(max-width: 768px) 100vw, 220px"
                  style={{ objectFit: "cover" }}
                  priority
                />
              </div>
              <div className={styles.triptychSmallBox}>
                <Image
                  src="/images/collaborate_craftsman.jpg"
                  alt="Master craftsman shaping hand-turned lamp component"
                  fill
                  sizes="(max-width: 768px) 100vw, 220px"
                  style={{ objectFit: "cover" }}
                  priority
                />
              </div>
            </div>

            <div className={styles.triptychTallBox}>
              <Image
                src="/images/collab_wood_lamp.jpg"
                alt="De Luzex architectural minimalist table lamp illuminating warm ambiance"
                fill
                sizes="(max-width: 768px) 100vw, 290px"
                style={{ objectFit: "cover" }}
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          2. HOW IT WORKS SECTION
          ────────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className={styles.howSection}>
        <div className={styles.howInner}>
          <div className={styles.howLeftCol}>
            {/* <span className={styles.sectionTag}>How it works</span> */}
            <h2 className={styles.sectionTitle}>
              From your drawing to our collection
            </h2>

            <div className={styles.designerProfileCard}>
              <h3 className={styles.designerProfileTitle}>Your designer profile</h3>
              <p className={styles.designerProfileDesc}>
                Share Your Work And Publish Your Writing On Lighting Through Your Own Deluzex Profile.
              </p>
              <a
                href="#submission-form"
                className={styles.designerProfileLink}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("submission-form");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    window.history.pushState(null, "", "#submission-form");
                  }
                }}
              >
                <span>Collaborate With Atelier</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </div>

          <div className={styles.timelineWrapper}>
            {/* Step 1 */}
            <div className={styles.timelineItem}>
              <div className={styles.timelineConnector} />
              <div className={styles.timelineIconBox}>
                <Image
                  src="/icons/collaborate/step-1-doc.png"
                  alt="Send us your design"
                  width={22}
                  height={24}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <div className={styles.timelineContent}>
                <h4 className={styles.timelineTitle}>Send us your design</h4>
                <p className={styles.timelineDesc}>
                  Upload Your Drawings, Renders Or Photographs. Tell Us About The Materials, Dimensions And Where The Light Would Be Used.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles.timelineItem}>
              <div className={styles.timelineConnector} />
              <div className={styles.timelineIconBox}>
                <Image
                  src="/icons/collaborate/step-2-review.png"
                  alt="We review the details"
                  width={22}
                  height={22}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <div className={styles.timelineContent}>
                <h4 className={styles.timelineTitle}>We review the details</h4>
                <p className={styles.timelineDesc}>
                  Our Team Looks At The Design And What It Would Take To Manufacture It At Our Unit.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles.timelineItem}>
              <div className={styles.timelineConnector} />
              <div className={styles.timelineIconBox}>
                <Image
                  src="/icons/collaborate/step-3-craft.png"
                  alt="We make the light"
                  width={24}
                  height={24}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <div className={styles.timelineContent}>
                <h4 className={styles.timelineTitle}>We make the light</h4>
                <p className={styles.timelineDesc}>
                  Approved Designs Go Into Production In Gujarat.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className={styles.timelineItem}>
              <div className={styles.timelineIconBox}>
                <Image
                  src="/icons/collaborate/step-4-sale.png"
                  alt="Your light goes on sale"
                  width={24}
                  height={24}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <div className={styles.timelineContent}>
                <h4 className={styles.timelineTitle}>Your light goes on sale</h4>
                <p className={styles.timelineDesc}>
                  Your Name Is Credited On The Product, Website And Catalogue. You Earn A Royalty On Every Unit Sold, Online Or Offline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          3. ALREADY OUT OF THE SKETCHBOOK
          ────────────────────────────────────────────────────────────────── */}
      <section className={styles.showcaseSection}>
        <div className={styles.showcaseInner}>
          <div className={styles.showcaseHeader}>
            <div className={styles.showcaseHeaderText}>

              <h2 className={styles.showcaseTitle}>
                Already out of the sketchbook
              </h2>
            </div>
            <p className={styles.showcaseHeaderDesc}>
              Meet AARIX SOLEN And AARIX MONDO, Designed By Ar. Faraz Bhai Of AandF Design Studio And Made By Deluzex
            </p>
          </div>

          <div className={styles.productCardsGrid}>
            {/* Card 1 */}
            <Link href="/shop" className={styles.productCollabCard}>
              <div className={styles.cardImageBox}>
                <Image
                  src="/images/collaborate_aarix_solen.png"
                  alt="AARIX SOLEN pendant light"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardTitleRow}>
                  <h3 className={styles.cardTitle}>AARIX SOLEN</h3>
                  <span className={styles.cardArrowCircle}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </span>
                </div>
                <p className={styles.cardDesc}>
                  A Round Glass Diffuser Framed By Fluted Porcelain In A Soft Grey-Green Glaze.
                </p>
                <div className={styles.designerBadgeWrapper}>
                  <span className={styles.designerBadge}>
                    Designed by Ar. Faraz Bhai, AandF Design Studio
                  </span>
                </div>
              </div>
            </Link>

            {/* Card 2 */}
            <Link href="/shop" className={styles.productCollabCard}>
              <div className={styles.cardImageBox}>
                <Image
                  src="/images/collaborate_aarix_sconce.png"
                  alt="AARIX SCONCE wall light"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardTitleRow}>
                  <h3 className={styles.cardTitle}>AARIX SOLEN</h3>
                  <span className={styles.cardArrowCircle}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </span>
                </div>
                <p className={styles.cardDesc}>
                  A Round Glass Diffuser Framed By Fluted Porcelain In A Soft Grey-Green Glaze.
                </p>
                <div className={styles.designerBadgeWrapper}>
                  <span className={styles.designerBadge}>
                    Designed by Ar. Faraz Bhai, AandF Design Studio
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className={styles.showcaseBottom}>
            <Link href="/shop" className={styles.btnExploreAarix}>
              Explore AARIX
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          4. FREQUENTLY ASKED QUESTIONS (DARK LUXURY SECTION - 100% PURE DYNAMIC)
          ────────────────────────────────────────────────────────────────── */}
      {(faqsLoading || faqs.length > 0) && (
        <section className={styles.faqSection}>
          <div className={styles.faqInner}>
            <div className={styles.faqHeader}>
              <h2 className={styles.faqTitle}>Frequently asked questions</h2>
              <div className={styles.faqDivider} />
              <p className={styles.faqSubtitle}>Common questions before you send your design to the Deluzex atelier.</p>
            </div>

            <div className={styles.accordionList}>
              {faqsLoading ? (
                [1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    style={{
                      height: "58px",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.05)",
                      marginBottom: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      opacity: 0.6,
                    }}
                  />
                ))
              ) : (
                faqs.map((item, idx) => {
                  const itemId = item._id || item.id || idx;
                  const isOpen = activeFaq === itemId;
                  return (
                    <div
                      key={itemId}
                      className={`${styles.accordionItem} ${isOpen ? styles.accordionItemActive : ""}`}
                    >
                      <button
                        type="button"
                        className={styles.accordionHeader}
                        onClick={() => toggleFaq(itemId)}
                        aria-expanded={isOpen}
                      >
                        <span>{item.question}</span>
                        <span className={styles.accordionIcon}>
                          {isOpen ? "×" : "+"}
                        </span>
                      </button>
                      {isOpen && (
                        <div className={styles.accordionBody}>
                          <p style={{ margin: 0 }}>{item.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}

            {/* 5. SUBMISSION FORM SECTION */}
      <section id="submission-form" className={styles.formSection}>
        <div className={styles.formInner}>

          {/* Top Row */}
          <div className={styles.formHeaderRow}>
            <div className={styles.formHeaderLeft}>
              <h2 className={styles.formTitle}>
                What&apos;s waiting in your sketchbook?
              </h2>
              <p className={styles.formDesc}>
                Share it with us. Upload your design and tell us a little about the light you have in mind.
              </p>
            </div>
            <div className={styles.formHeaderImage}>
              <Image
                src="/images/collaborate_origami_lamp.png"
                alt="Folded ambient origami lamp in artisan studio"
                fill
                sizes="(max-width: 768px) 100vw, 520px"
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>

          {submitted ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>&#10003;</div>
              <h3 className={styles.successTitle}>Design Received</h3>
              <p className={styles.successDesc}>
                Thank you for sharing your creative vision with De Luzex. Our curation and production team will review your concept and reach out within 10 to 14 business days.
              </p>
              <button type="button" className={styles.btnPrimary} onClick={resetForm}>
                Submit Another Design
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.formCard} noValidate>
              <div className={styles.formFieldsGrid}>

                <div className={styles.inputField}>
                  <label htmlFor="fullName">
                    Full Name <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    required
                    placeholder="Enter your name"
                    value={formFields.fullName}
                    onChange={handleInputChange}
                    className={formErrors.fullName ? styles.inputError : ""}
                  />
                  {formErrors.fullName && (
                    <span className={styles.fieldError}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {formErrors.fullName}
                    </span>
                  )}
                </div>

                <div className={styles.inputField}>
                  <label htmlFor="email">
                    Email <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="Enter your email"
                    value={formFields.email}
                    onChange={handleInputChange}
                    className={formErrors.email ? styles.inputError : ""}
                  />
                  <span className={styles.inputHelper}>we&apos;ll contact you here about your design</span>
                  {formErrors.email && (
                    <span className={styles.fieldError}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {formErrors.email}
                    </span>
                  )}
                </div>

                <div className={styles.inputField}>
                  <label htmlFor="phone">
                    Phone Number <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    placeholder="Enter your number"
                    value={formFields.phone}
                    onChange={handleInputChange}
                    className={formErrors.phone ? styles.inputError : ""}
                  />
                  {formErrors.phone && (
                    <span className={styles.fieldError}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {formErrors.phone}
                    </span>
                  )}
                </div>

                <div className={styles.inputField}>
                  <label id="cityLabel">City</label>
                  <div className={styles.customSelectWrapper} ref={cityDropdownRef}>
                    <button type="button" id="city"
                      className={`${styles.customSelectTrigger} ${isCityOpen ? styles.customSelectTriggerOpen : ""}`}
                      onClick={() => { setIsCityOpen((prev) => !prev); setIsRoleOpen(false); }}
                      aria-haspopup="listbox" aria-expanded={isCityOpen} aria-labelledby="cityLabel"
                    >
                      <span className={formFields.city ? styles.customSelectValue : styles.customSelectPlaceholder}>{formFields.city || "Select your city"}</span>
                      <svg className={`${styles.customSelectChevron} ${isCityOpen ? styles.customSelectChevronOpen : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {isCityOpen && (
                      <ul className={styles.customSelectMenu} role="listbox" aria-labelledby="cityLabel">
                        {CITIES.map((c) => { const isSelected = formFields.city === c; return (
                          <li key={c} role="option" aria-selected={isSelected}
                            className={`${styles.customSelectOption} ${isSelected ? styles.customSelectOptionSelected : ""}`}
                            onClick={() => { setFormFields((prev) => ({ ...prev, city: c })); setIsCityOpen(false); }}>
                            <span>{c}</span>
                            {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          </li>
                        ); })}
                      </ul>
                    )}
                  </div>
                </div>

                <div className={styles.inputField}>
                  <label id="roleLabel">I&apos;m a</label>
                  <div className={styles.customSelectWrapper} ref={roleDropdownRef}>
                    <button type="button" id="role"
                      className={`${styles.customSelectTrigger} ${isRoleOpen ? styles.customSelectTriggerOpen : ""}`}
                      onClick={() => { setIsRoleOpen((prev) => !prev); setIsCityOpen(false); }}
                      aria-haspopup="listbox" aria-expanded={isRoleOpen} aria-labelledby="roleLabel"
                    >
                      <span className={formFields.role ? styles.customSelectValue : styles.customSelectPlaceholder}>{formFields.role || "Select your role"}</span>
                      <svg className={`${styles.customSelectChevron} ${isRoleOpen ? styles.customSelectChevronOpen : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {isRoleOpen && (
                      <ul className={styles.customSelectMenu} role="listbox" aria-labelledby="roleLabel">
                        {ROLES.map((r) => { const isSelected = formFields.role === r; return (
                          <li key={r} role="option" aria-selected={isSelected}
                            className={`${styles.customSelectOption} ${isSelected ? styles.customSelectOptionSelected : ""}`}
                            onClick={() => { setFormFields((prev) => ({ ...prev, role: r })); setIsRoleOpen(false); }}>
                            <span>{r}</span>
                            {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          </li>
                        ); })}
                      </ul>
                    )}
                  </div>
                </div>

                <div className={styles.inputField}>
                  <label htmlFor="studioOrCollege">Studio or College (optional)</label>
                  <input type="text" id="studioOrCollege" name="studioOrCollege" placeholder="Enter your studio or college name" value={formFields.studioOrCollege} onChange={handleInputChange} />
                </div>

                <div className={`${styles.inputField} ${styles.colSpan2}`}>
                  <label htmlFor="designDescription">About your design</label>
                  <textarea id="designDescription" name="designDescription" rows={3}
                    placeholder="Tell us what inspired it, the materials, its dimensions and where you imagine it being used."
                    value={formFields.designDescription} onChange={handleInputChange} />
                </div>

                <div className={`${styles.radioGroup} ${styles.colSpan2}`}>
                  <span className={styles.radioLabel}>Has this light been made before?</span>
                  <div className={styles.radioChoices}>
                    <label className={`${styles.radioOption} ${hasMadeBefore === "yes" ? styles.radioOptionActive : ""}`}>
                      <input type="radio" name="hasMadeBefore" value="yes" checked={hasMadeBefore === "yes"} onChange={() => setHasMadeBefore("yes")} />
                      <span className={`${styles.customRadio} ${hasMadeBefore === "yes" ? styles.customRadioChecked : ""}`}>{hasMadeBefore === "yes" && <span className={styles.customRadioDot} />}</span>
                      <span className={styles.radioText}>Yes</span>
                    </label>
                    <label className={`${styles.radioOption} ${hasMadeBefore === "no" ? styles.radioOptionActive : ""}`}>
                      <input type="radio" name="hasMadeBefore" value="no" checked={hasMadeBefore === "no"} onChange={() => setHasMadeBefore("no")} />
                      <span className={`${styles.customRadio} ${hasMadeBefore === "no" ? styles.customRadioChecked : ""}`}>{hasMadeBefore === "no" && <span className={styles.customRadioDot} />}</span>
                      <span className={styles.radioText}>No</span>
                    </label>
                  </div>
                </div>

                <div className={`${styles.inputField} ${styles.colSpan2}`}>
                  <label>
                    Upload your design <span className={styles.requiredStar}>*</span>
                  </label>
                  <div
                    className={`${styles.uploadDropZone} ${formErrors.file ? styles.uploadDropZoneError : ""} ${selectedFile ? styles.uploadDropZoneSelected : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept=".png,.jpg,.jpeg,.svg,.pdf"
                      onChange={handleFileChange}
                    />
                    <div className={styles.uploadLeft}>
                      <div className={styles.uploadIcon}>
                        {selectedFile ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D79322" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={formErrors.file ? "#EF4444" : "#D8A56E"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                            <path d="M12 12v9" /><path d="m8 16 4-4 4 4" />
                          </svg>
                        )}
                      </div>
                      <div className={styles.uploadTextGroup}>
                        <p className={styles.uploadTitle}>
                          {selectedFile ? selectedFile.name : "Upload images or PDF"}
                        </p>
                        <p className={styles.uploadSub}>
                          {selectedFile
                            ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace`
                            : "PNG, JPG, SVG or PDF up to 10 MB (Compulsory)"}
                        </p>
                      </div>
                    </div>
                    <div className={styles.uploadActions}>
                      <button type="button" className={styles.uploadBtn}>
                        {selectedFile ? "Replace" : "Browse File"}
                      </button>
                      {selectedFile && (
                        <button
                          type="button"
                          className={styles.uploadRemoveBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {formErrors.file && (
                    <span className={styles.fieldError}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {formErrors.file}
                    </span>
                  )}
                </div>

              </div>

              <div className={styles.formFooter}>
                <div className={styles.formFooterLeft}>
                  <label className={styles.termsCheckbox}>
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => {
                        setAgreedTerms(e.target.checked);
                        if (e.target.checked) setFormErrors((prev) => ({ ...prev, terms: undefined }));
                      }}
                    />
                    <span>I have read and agree to the submission terms.</span>
                  </label>
                  {formErrors.terms && (
                    <span className={styles.fieldError}>
                      {formErrors.terms}
                    </span>
                  )}
                  {errorMessage && (
                    <div className={styles.formGlobalError}>
                      {errorMessage}
                    </div>
                  )}
                </div>
                <button type="submit" className={styles.btnSubmitForm} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Your Design"}
                </button>
              </div>
            </form>
          )}

        </div>
      </section>
    </main>
  );
}