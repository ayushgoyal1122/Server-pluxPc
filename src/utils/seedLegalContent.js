import { LegalContent } from '../models/LegalContent.js';

export const INITIAL_LEGAL_PAGES = [
  {
    slug: 'terms-and-conditions',
    title: 'Terms & Conditions',
    status: 'published',
    lastUpdatedBy: 'System Baseline',
    content: `## 1. Introduction & Acceptance of Terms
Welcome to PLUXPC Electronics ("PLUXPC", "we", "our", or "us"). By accessing or using our website, purchasing our audio and electronics products, or utilizing any PLUXPC services, you agree to be legally bound by these Terms & Conditions. If you do not agree to all terms stated herein, please refrain from using our storefront or placing orders.

## 2. Eligibility & Account Security
- To register an account or purchase products on PLUXPC, you must be at least 18 years of age or the age of majority in your jurisdiction.
- You are responsible for safeguarding your login credentials, password, and session access.
- Any activity or purchase originating from your authenticated account remains your sole legal and financial responsibility.

## 3. Product Catalog, Specifications & Pricing
- We strive to display product specifications, acoustic curves, battery metrics, and visual finishes as accurately as possible.
- All prices listed on PLUXPC are in Indian Rupees (INR) and are inclusive of applicable Goods and Services Tax (GST) unless explicitly indicated otherwise.
- PLUXPC reserves the right to modify prices, discontinue promotional discounts, or correct inadvertent typographical errors without prior notice.

## 4. Orders, Payment & Verification
- Orders placed on PLUXPC represent an offer to purchase and are subject to stock availability and payment verification.
- Payments are processed securely via authorized payment gateways (including Razorpay, UPI, Credit/Debit cards, Net Banking, and Wallets).
- An order is considered confirmed only after successful gateway authorization and issuance of an official PLUXPC Order Confirmation.
- PLUXPC reserves the right to cancel suspected fraudulent orders, unauthorized bulk dealer purchases, or transactions failing verification.

## 5. Shipping & Delivery
- Standard Express Delivery typically arrives within 2 to 4 business days depending on delivery PIN codes across India.
- While we partner with reputable courier networks to ensure timely dispatch, PLUXPC is not liable for force majeure events, transit strikes, or severe weather delays.
- Risk of loss transfers to the customer upon delivery confirmation at the destination address provided during checkout.

## 6. Returns, Replacements & Warranty
- **7-Day Return Policy**: Defective or damaged items reported within 7 calendar days of delivery are eligible for replacement or full refund after technical verification.
- **1-Year Brand Warranty**: All brand-new PLUXPC audio hardware and wearables include our standard 1-year limited manufacturer warranty against manufacturing defects.
- Warranty excludes unauthorized modifications, liquid damage on non-waterproof models, physical abuse, or third-party unauthorized repairs.

## 7. Intellectual Property
All brand trademarks, trade names, logo assets, visual illustrations, product industrial designs, and software code on PLUXPC are the exclusive intellectual property of PLUXPC Electronics Pvt. Ltd. Unauthorized commercial reuse, scraping, or duplication is strictly prohibited.

## 8. Limitation of Liability
To the maximum extent permitted by applicable Indian law, PLUXPC shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from product use or inability to use our services.

## 9. Governing Law & Dispute Resolution
These Terms & Conditions shall be governed by and construed in accordance with the laws of India. Any legal dispute or claim arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in Indore, Madhya Pradesh.

## 10. Contact Us
For questions regarding these Terms & Conditions or order assistance, please reach out to our legal and support team at **support@pluxpc.com** or **dev@youngdecade.com**.`,
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    status: 'published',
    lastUpdatedBy: 'System Baseline',
    content: `## 1. Our Commitment to Your Privacy
PLUXPC Electronics ("PLUXPC", "we", "our") values the trust you place in us when sharing your personal information. This Privacy Policy details the types of information we collect, how we securely store and process it, and your rights concerning your personal data in compliance with the Digital Personal Data Protection Act (DPDPA) and applicable privacy regulations.

## 2. Information We Collect
We collect information strictly necessary to provide seamless shopping, order processing, and warranty support:
- **Identity & Contact Details**: Full legal name, email address, contact telephone number, and residential delivery addresses.
- **Account Credentials**: Securely hashed passwords, login timestamps, and account preferences.
- **Transaction & Order Records**: Order IDs, items purchased, product serials, platform fee details, and transaction receipts.
- **Technical & Device Information**: IP address, browser type, device identifiers, and session analytics collected via essential cookies.

*Note: PLUXPC never stores full credit card numbers, debit card PINs, or banking CVV codes on our servers. All monetary transactions are processed through PCI-DSS Level 1 certified payment gateways (Razorpay).*

## 3. How We Use Your Information
Your personal information is processed exclusively for legitimate business and fulfillment purposes:
- Fulfilling orders, organizing courier dispatch, and communicating shipment tracking notifications.
- Sending transactional order confirmation receipts and invoices via Nodemailer.
- Facilitating warranty registrations, service tickets, and authentic replacement processing.
- Preventing fraud, mitigating unauthorized account logins, and ensuring platform security.
- Improving storefront performance and optimizing user navigation.

## 4. Information Sharing & Third-Party Disclosures
PLUXPC does **not** sell, rent, monetize, or trade your personal data to third-party data brokers. We share data solely with trusted service providers bound by strict confidentiality obligations:
- **Logistics Partners**: Delivering packages to your doorstep (name, delivery address, phone number).
- **Payment Processors**: Authorizing checkout charges securely (Razorpay).
- **Communication Gateways**: Sending transactional emails and SMS tracking updates.
- **Legal Compliance**: When required by law enforcement, court order, or regulatory statute.

## 5. Data Security & Storage Safeguards
- We enforce robust technical safeguards including TLS 1.3 encryption in transit, salted password hashing (bcrypt), and role-based access control (RBAC).
- Internal access to customer data is strictly restricted to authorized administrative personnel on a need-to-know basis.
- Regular database backups and vulnerability assessments are conducted to safeguard integrity.

## 6. Cookies & Tracking Preferences
PLUXPC utilizes essential cookies to maintain shopping cart sessions, authentication tokens, and user preferences. You may configure your browser to decline non-essential cookies, though certain shopping features may have reduced functionality.

## 7. Your Data Rights & Choices
You possess the right to:
- Access, review, and request a copy of your personal data stored with us.
- Request correction of inaccurate or incomplete contact or delivery information.
- Request account deactivation or deletion subject to statutory tax and warranty retention requirements.
- Opt out of non-transactional marketing announcements at any time.

## 8. Updates to this Policy
We may periodically update this Privacy Policy to reflect changing regulatory requirements or operational improvements. The updated version will be marked with a revised date at the top of this page.

## 9. Contacting Our Data Privacy Officer
If you have inquiries, complaints, or wish to exercise your data protection rights, please contact our Data Protection Officer at **privacy@pluxpc.com** or **support@pluxpc.com**.`,
  },
];

/**
 * Initializes legal pages baseline if the collection is empty.
 * Preserves any existing legal content without overwriting.
 */
export async function seedInitialLegalContent(force = false) {
  try {
    const existingCount = await LegalContent.countDocuments();
    if (existingCount > 0 && !force) {
      console.log(`[Seed Legal Content]: Legal content already initialized (${existingCount} records found).`);
      return;
    }

    for (const page of INITIAL_LEGAL_PAGES) {
      const exists = await LegalContent.findOne({ slug: page.slug });
      if (!exists) {
        await LegalContent.create({
          ...page,
          characterCount: page.content.length,
        });
        console.log(`[Seed Legal Content]: Created baseline legal page "${page.title}" (${page.slug})`);
      }
    }
  } catch (err) {
    console.error('[Seed Legal Content Error]:', err.message);
  }
}

