"use client";
import React, { useEffect, useState } from "react";
import { uploadFileToCloudinary } from "@/lib/upload";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../../admin/admin.module.css";
import { createProduct, fetchCategories, Category, ProductSpecification } from "../../../services/api";

export default function CreateProduct() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [formData, setFormData] = useState({
    product_title: "",
    product_description: "",
    product_price: "",
    product_category: "",
    product_material: "",
    product_voltage: "",
    product_style: "",
    product_finishing: "",
    // New design & spec fields
    sku: "",
    stock_count: "50",
    stock_status: "IN STOCK",
    price_prefix: "From",
    price_note: "per piece (volume contract applicable)",
    dimensions: "",
    finish: "",
    material: "",
    colorway: "",
    piece_weight: "",
    care: "",
    moq_rule: "50 Pieces per order",
    replenishment: "Guaranteed available for 5 years minimum",
    whatsapp_number: "",
    phone_number: "",
    amazon_link: "",
  });

  const [customSpecs, setCustomSpecs] = useState<ProductSpecification[]>([]);
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [specPdf, setSpecPdf] = useState<File | null>(null);
  const [specPdfUrl, setSpecPdfUrl] = useState<string>("");
  const [isNewArrival, setIsNewArrival] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMainImage(file);
      setMainImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setGalleryFiles((prev) => [...prev, ...selected]);
      e.target.value = "";
    }
  };

  const handleRemoveGalleryFile = (index: number) => {
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllGalleryFiles = () => {
    setGalleryFiles([]);
  };

  const handleAddCustomSpec = () => {
    setCustomSpecs([...customSpecs, { key: "", value: "" }]);
  };

  const handleRemoveCustomSpec = (index: number) => {
    setCustomSpecs(customSpecs.filter((_, i) => i !== index));
  };

  const handleCustomSpecChange = (index: number, field: "key" | "value", value: string) => {
    const updated = [...customSpecs];
    updated[index][field] = value;
    setCustomSpecs(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!mainImage) {
        alert("Please select a main image");
        setLoading(false);
        return;
      }
      
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          payload.append(key, String(value));
        }
      });
      payload.append("is_new_arrival", String(isNewArrival));
      
      // Filter non-empty custom specs
      const validSpecs = customSpecs.filter(s => s.key.trim() && s.value.trim());
      if (validSpecs.length > 0) {
        payload.append("specifications", JSON.stringify(validSpecs));
      }
      
      let mainImageUrl = "";
      if (mainImage) {
        try {
          const uploadRes = await uploadFileToCloudinary(mainImage, "products");
          if (uploadRes?.url) {
            mainImageUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn("Direct upload fallback:", uploadErr);
        }
      }

      if (mainImageUrl) {
        payload.append("product_main_image_url", mainImageUrl);
      } else if (mainImage) {
        payload.append("product_main_image", mainImage);
      }
      galleryFiles.forEach((file) => {
        payload.append("product_images", file);
      });

      if (specPdf) {
        payload.append("technical_spec_pdf", specPdf);
      } else if (specPdfUrl.trim()) {
        payload.append("technical_spec_pdf_url", specPdfUrl.trim());
      }

      await createProduct(payload);
      router.push("/admin/products");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to create product");
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', 
    border: '1px solid rgba(0,0,0,0.12)', marginTop: '0.4rem', 
    fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  const sectionHeaderStyle = {
    fontSize: '1rem', fontWeight: 600, color: 'var(--admin-primary)',
    marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
  };

  return (
    <div className={styles.sectionContainer} style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/admin/products" style={{ color: 'var(--color-text-light)', fontSize: '0.85rem', display: 'inline-block', marginBottom: '1rem' }}>
          &larr; Back to Products
        </Link>
        <h2 className={styles.sectionTitle}>Add New Product</h2>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
          Configure product details, technical specifications, and imagery matching the luxury catalog design.
        </p>
      </div>

      <div style={{ background: 'var(--color-white)', borderRadius: '12px', padding: 'var(--a-space-5)', width: '100%', maxWidth: '100%', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <form onSubmit={handleSubmit} className={styles.formGrid2} style={{ display: 'grid', gap: '1.5rem' }}>
          
          {/* GENERAL INFO */}
          <div style={{ gridColumn: '1 / -1' }}>
            <h3 style={sectionHeaderStyle}>Basic Information</h3>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Product Title *</label>
            <input required type="text" name="product_title" value={formData.product_title} onChange={handleChange} style={inputStyle} placeholder="e.g. Matte Earth Dinner Plate" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>SKU (Stock Keeping Unit) *</label>
            <input required type="text" name="sku" value={formData.sku} onChange={handleChange} style={inputStyle} placeholder="e.g. ME-DP-105" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Stock Status *</label>
            <select name="stock_status" value={formData.stock_status} onChange={handleChange} style={inputStyle}>
              <option value="IN STOCK">IN STOCK (Green Badge)</option>
              <option value="MADE TO ORDER">MADE TO ORDER (Amber Badge)</option>
              <option value="OUT OF STOCK">OUT OF STOCK (Red Badge)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Stock Quantity (Units Available) *</label>
            <input
              type="number"
              min="0"
              name="stock_count"
              value={formData.stock_count}
              onChange={(e) => {
                const count = parseInt(e.target.value) || 0;
                setFormData((prev) => ({
                  ...prev,
                  stock_count: e.target.value,
                  stock_status: count > 0 ? "IN STOCK" : "OUT OF STOCK"
                }));
              }}
              style={inputStyle}
              placeholder="e.g. 50"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Price (₹) *</label>
            <input required type="number" step="0.01" name="product_price" value={formData.product_price} onChange={handleChange} style={inputStyle} placeholder="e.g. 450" />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>Category *</label>
              <Link href="/admin/categories" target="_blank" style={{ fontSize: '0.75rem', color: '#C49A45', textDecoration: 'none' }}>
                + Manage Categories
              </Link>
            </div>
            <select required name="product_category" value={formData.product_category} onChange={handleChange} style={inputStyle}>
              <option value="" disabled>Select a category</option>
              {categories.map((c, idx) => <option key={c.id || c._id || c.name || idx} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Price Prefix</label>
            <input type="text" name="price_prefix" value={formData.price_prefix} onChange={handleChange} style={inputStyle} placeholder="e.g. From" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Price Note / Subtitle</label>
            <input type="text" name="price_note" value={formData.price_note} onChange={handleChange} style={inputStyle} placeholder="e.g. per piece (volume contract applicable)" />
          </div>

          {/* TECHNICAL SPECIFICATIONS */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <h3 style={sectionHeaderStyle}>Technical Specifications</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--admin-text-muted)', marginBottom: '1.25rem' }}>
              These specifications are featured directly in the product detail technical specifications table.
            </p>
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Dimensions</label>
            <input type="text" name="dimensions" value={formData.dimensions} onChange={handleChange} style={inputStyle} placeholder="e.g. 10.5 inch (26.7 cm) Diameter" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Finish</label>
            <input type="text" name="finish" value={formData.finish} onChange={handleChange} style={inputStyle} placeholder="e.g. Earthy Matte Clay Slip (Fingerprint Resistant)" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Material</label>
            <input type="text" name="material" value={formData.material} onChange={handleChange} style={inputStyle} placeholder="e.g. High-Alumina Vitrified Stoneware" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Colorway</label>
            <input type="text" name="colorway" value={formData.colorway} onChange={handleChange} style={inputStyle} placeholder="e.g. Warm Terracotta Basalt" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Piece Weight</label>
            <input type="text" name="piece_weight" value={formData.piece_weight} onChange={handleChange} style={inputStyle} placeholder="e.g. 380g" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Care</label>
            <input type="text" name="care" value={formData.care} onChange={handleChange} style={inputStyle} placeholder="e.g. Oven, Microwave, & High-Temp Dishwasher Safe" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>MOQ Rule</label>
            <input type="text" name="moq_rule" value={formData.moq_rule} onChange={handleChange} style={inputStyle} placeholder="e.g. 50 Pieces per order" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Replenishment</label>
            <input type="text" name="replenishment" value={formData.replenishment} onChange={handleChange} style={inputStyle} placeholder="e.g. Guaranteed available for 5 years minimum" />
          </div>

          {/* CUSTOM SPECIFICATIONS BUILDER */}
          <div style={{ gridColumn: '1 / -1', background: 'var(--admin-surface-muted)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--admin-text-main)' }}>+ Additional Custom Specifications</span>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Add any other custom key-value rows to the Technical Specifications table.</p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomSpec}
                style={{ background: '#0F172A', color: '#fff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                + Add Spec Row
              </button>
            </div>

            {customSpecs.map((spec, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '0.75rem', marginBottom: '0.65rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Specification Name (e.g. Glaze Type)"
                  value={spec.key}
                  onChange={(e) => handleCustomSpecChange(idx, "key", e.target.value)}
                  style={{ ...inputStyle, marginTop: 0 }}
                />
                <input
                  type="text"
                  placeholder="Specification Value (e.g. Lead-Free Satin)"
                  value={spec.value}
                  onChange={(e) => handleCustomSpecChange(idx, "value", e.target.value)}
                  style={{ ...inputStyle, marginTop: 0 }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCustomSpec(idx)}
                  style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none', padding: '0.65rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* TECHNICAL SPECIFICATION PDF */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <h3 style={sectionHeaderStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Technical Specification PDF / Brochure
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--admin-text-muted)', marginBottom: '0.75rem' }}>
              Upload an official product datasheet or brochure PDF. Customers can read and download this document directly from the product page.
            </p>
            <div style={{ background: 'var(--admin-surface-muted)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
              {specPdf ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--admin-surface)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
                      PDF
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--admin-text-main)' }}>{specPdf.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{(specPdf.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpecPdf(null)}
                    style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSpecPdf(e.target.files[0]);
                      }
                    }}
                    style={inputStyle}
                  />
                  <div style={{ margin: '0.85rem 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>OR Enter ImageKit / PDF URL</span>
                    <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                  </div>
                  <input
                    type="url"
                    placeholder="e.g. https://ik.imagekit.io/2s78gfu2x/specs/datasheet.pdf"
                    value={specPdfUrl}
                    onChange={(e) => setSpecPdfUrl(e.target.value)}
                    style={{ ...inputStyle, marginTop: 0 }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* CONTACT & OVERRIDES */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem' }}>
            <h3 style={sectionHeaderStyle}>Dedicated Contact Overrides (Optional)</h3>
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Dedicated WhatsApp Number</label>
            <input type="text" name="whatsapp_number" value={formData.whatsapp_number} onChange={handleChange} style={inputStyle} placeholder="Leave empty for site default (918511682031)" />
          </div>

          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Dedicated Phone Number</label>
            <input type="text" name="phone_number" value={formData.phone_number} onChange={handleChange} style={inputStyle} placeholder="Leave empty for site default (+91 85116 82031)" />
          </div>

          {/* EXTERNAL MARKETPLACE INTEGRATIONS */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <h3 style={sectionHeaderStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              External Marketplaces (Amazon)
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--admin-text-muted)', margin: '0.25rem 0 0.85rem' }}>
              Add a direct Amazon product listing URL. If configured, a &quot;Buy on Amazon&quot; button will dynamically appear on the product page.
            </p>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Amazon Product URL</label>
            <input
              type="url"
              name="amazon_link"
              value={formData.amazon_link}
              onChange={handleChange}
              style={inputStyle}
              placeholder="e.g. https://www.amazon.in/dp/B08N5WRWNW or https://amazon.com/..."
            />
          </div>

          {/* MEDIA & GALLERY */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={sectionHeaderStyle}>Product Media & Gallery</h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--admin-text-muted)', margin: '0.25rem 0 0' }}>
                  Upload the main cover image and dynamic gallery photos (1, 2, 3, or more).
                </p>
              </div>
              {galleryFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllGalleryFiles}
                  style={{
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    color: '#DC2626',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Clear Gallery ({galleryFiles.length})
                </button>
              )}
            </div>
            
            {/* Main Cover Image */}
            <div style={{ background: 'var(--admin-surface-muted)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '0.5rem' }}>
                Main Cover Image *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {mainImagePreview && (
                  <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #E0531C', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mainImagePreview} alt="Main preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input required={!mainImage} type="file" accept="image/*" onChange={handleMainImageChange} style={inputStyle} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                    Primary display image across store catalog and product hero showcase.
                  </span>
                </div>
              </div>
            </div>
            
            {/* Additional Gallery Images */}
            <div style={{ background: 'var(--admin-surface-muted)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    Additional Gallery Images
                  </label>
                  <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginLeft: '0.5rem' }}>
                    ({galleryFiles.length} selected — add one or multiple)
                  </span>
                </div>
              </div>

              {/* Upload Drop/Click Box */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.25rem',
                    border: '2px dashed var(--admin-border)',
                    borderRadius: '8px',
                    background: 'var(--admin-surface)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleAddGalleryFiles}
                    style={{ display: 'none' }}
                  />
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--admin-primary)' }}>
                    + Click to select gallery images (upload single or multiple)
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-subtle)', marginTop: '0.25rem' }}>
                    Select 1, 2, 3 or more images. You can add more at any time.
                  </span>
                </label>
              </div>

              {/* Gallery Image Previews */}
              {galleryFiles.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(130px, 100%), 1fr))',
                  gap: '0.85rem',
                  marginTop: '1rem',
                }}>
                  {galleryFiles.map((file, idx) => {
                    const previewUrl = URL.createObjectURL(file);
                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        style={{
                          position: 'relative',
                          background: 'var(--admin-surface)',
                          borderRadius: '8px',
                          border: '1px solid var(--admin-border)',
                          overflow: 'hidden',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', height: '100px', background: 'var(--admin-surface-muted)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt={`Gallery ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <span style={{
                            position: 'absolute',
                            top: '5px',
                            left: '5px',
                            background: 'rgba(0,0,0,0.65)',
                            color: '#FFFFFF',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryFile(idx)}
                            title="Remove image"
                            style={{
                              position: 'absolute',
                              top: '5px',
                              right: '5px',
                              background: '#EF4444',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* NEW ARRIVAL TOGGLE */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem' }}>
            <div style={{
              background: isNewArrival ? '#FFFBEB' : '#f8fafc',
              border: isNewArrival ? '1px solid #F59E0B' : '1px solid var(--admin-border)',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.2s',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: isNewArrival ? '#92400E' : 'var(--admin-primary)', fontSize: '0.95rem' }}>
                  <span>★ Feature in Homepage New Arrivals Carousel</span>
                  {isNewArrival && (
                    <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.825rem', color: 'var(--admin-text-muted)' }}>
                  When enabled, this product will immediately show up in the New Arrivals carousel on the homepage.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={isNewArrival}
                  onChange={(e) => setIsNewArrival(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: isNewArrival ? '#C49A45' : '#cbd5e1',
                  borderRadius: '34px',
                  transition: '0.2s',
                }}>
                  <span style={{
                    position: 'absolute',
                    height: '20px',
                    width: '20px',
                    left: isNewArrival ? '24px' : '4px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }}>Description *</label>
            <textarea required name="product_description" value={formData.product_description} onChange={handleChange} style={{ ...inputStyle, minHeight: '120px' }} placeholder="Our signature rustic flat plate crafted from refined red terracotta clays..." />
          </div>

          {/* SUBMIT BUTTON */}
          <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#E0531C',
                color: '#fff',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(224, 83, 28, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem'
              }}
            >
              {loading ? (
                <>
                  <svg style={{ animation: 'spin 0.75s linear infinite' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Saving Product...</span>
                </>
              ) : (
                "Save Product"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

