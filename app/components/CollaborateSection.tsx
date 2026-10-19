
"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./CollaborateSection.module.css";

export default function CollaborateSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Architect / Interior Designer",
    conceptTitle: "",
    description: "",
    portfolioLink: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormSubmitted(false);
  };

  return (
    <section id="collaborate" className={styles.collaborateSection}>
      <div className={styles.collaborateInner}>
        {/* Left White Content Card */}
        <div className={styles.collaborateCard}>
          <p className={styles.collaborateTagline}>Design with Deluzex</p>
          <h2 className={styles.collaborateTitle}>
            Have an Idea for a Light?<br />
            Let’s Build It Together.
          </h2>

          <p className={styles.collaborateDesc}>
            We Invite Architects, Lighting Designers, Product Designers, And Creative Minds To Share Their Original Lighting Concepts With Us.
          </p>

          <p className={styles.collaborateDesc}>
            If Selected, We&apos;ll Help Develop And Launch Your Design Through De Luzex. You&apos;ll Earn From Every Sale.
          </p>

          <div className={styles.collaborateActions}>
            <button
              type="button"
              className={styles.btnSubmitDesign}
              onClick={() => setIsModalOpen(true)}
            >
              Submit Your Design
            </button>
            <Link
              href="/collaborate"
              className={styles.linkLearnHow}
            >
              <span>How it works</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Right Dual Visual Showcase */}
        <div className={styles.collaborateVisuals}>
          {/* Sketch Blueprint Image */}
          <div className={styles.collaborateSketchBox}>
            <Image
              src="/images/collaborate_sketch.jpg"
              alt="Lighting Concept Architectural Sketch"
              fill
              sizes="(max-width: 600px) 125px, (max-width: 1200px) 190px, 230px"
              style={{ objectFit: "cover" }}
            />
          </div>

          {/* Craftsman in Workshop Image */}
          <div className={styles.collaborateCraftBox}>
            <Image
              src="/images/collaborate_craftsman.jpg"
              alt="Artisan Lighting Craftsman Shaping Fixture"
              fill
              sizes="(max-width: 600px) 185px, (max-width: 1200px) 270px, 320px"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>

      {/* Submit Design Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={closeModal}
              aria-label="Close modal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!formSubmitted ? (
              <>
                <p className={styles.modalTagline}>Co-Creation with De Luzex</p>
                <h3 className={styles.modalTitle}>Submit Your Lighting Concept</h3>
                <p className={styles.modalDesc}>
                  Share your original sketch, 3D rendering, or conceptual ideas. If selected, our master artisans and engineers will bring it to life under the De Luzex brand.
                </p>

                <form className={styles.modalForm} onSubmit={handleSubmit}>
                  <div className={styles.formRow}>
                    <div className={styles.formField}>
                      <label htmlFor="collab-name">Your Name *</label>
                      <input
                        id="collab-name"
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. Liam Sterling"
                      />
                    </div>
                    <div className={styles.formField}>
                      <label htmlFor="collab-email">Email Address *</label>
                      <input
                        id="collab-email"
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@studio.com"
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formField}>
                      <label htmlFor="collab-phone">Phone / WhatsApp</label>
                      <input
                        id="collab-phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+91 / International"
                      />
                    </div>
                    <div className={styles.formField}>
                      <label htmlFor="collab-role">Design Background</label>
                      <select
                        id="collab-role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                      >
                        <option>Architect / Interior Designer</option>
                        <option>Industrial / Product Designer</option>
                        <option>Lighting Designer / Engineer</option>
                        <option>Independent Artist / Maker</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formField}>
                    <label htmlFor="collab-title">Concept Name / Fixture Type *</label>
                    <input
                      id="collab-title"
                      type="text"
                      name="conceptTitle"
                      required
                      value={formData.conceptTitle}
                      onChange={handleChange}
                      placeholder="e.g. Sculptural Floating Ring Pendant"
                    />
                  </div>

                  <div className={styles.formField}>
                    <label htmlFor="collab-portfolio">Portfolio or Concept Link (Drive / Behance / Web)</label>
                    <input
                      id="collab-portfolio"
                      type="url"
                      name="portfolioLink"
                      value={formData.portfolioLink}
                      onChange={handleChange}
                      placeholder="https://behance.net/your-project or Google Drive link"
                    />
                  </div>

                  <div className={styles.formField}>
                    <label htmlFor="collab-desc">Concept Description &amp; Inspiration</label>
                    <textarea
                      id="collab-desc"
                      name="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe the materials, lighting effect, and inspiration behind your concept..."
                    />
                  </div>

                  <button type="submit" className={styles.modalSubmitBtn}>
                    Send Concept for Review
                  </button>
                </form>
              </>
            ) : (
              <div className={styles.modalSuccessState}>
                <div className={styles.successIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className={styles.modalTitle}>Concept Received!</h3>
                <p className={styles.modalDesc}>
                  Thank you, <strong>{formData.name}</strong>. Our design curation panel reviews all submissions weekly. If your concept aligns with our upcoming collection, we will reach out to schedule an introductory co-design session.
                </p>
                <button
                  type="button"
                  className={styles.modalSubmitBtn}
                  onClick={closeModal}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
