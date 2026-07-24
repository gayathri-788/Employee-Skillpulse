import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def generate_resume_pdf(emp) -> bytes:
    """Generates a professional PDF resume using the exact single-column WPS document layout."""
    buffer = BytesIO()
    
    # 0.5 inch margins (36pt) to match standard resume layouts
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Define styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#000000'),
        alignment=TA_CENTER,
        spaceAfter=3
    )
    
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#000000'),
        alignment=TA_CENTER,
        spaceAfter=4
    )
    
    contact_style = ParagraphStyle(
        'Contact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#000000'),
        alignment=TA_CENTER,
        spaceAfter=8
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#000000'),
        spaceBefore=10,
        spaceAfter=2,
        alignment=TA_LEFT
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4,
        alignment=TA_LEFT
    )
    
    body_bold_style = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    bullet_style = ParagraphStyle(
        'Bullet',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2
    )

    story = []

    # Helper function to convert newlines to paragraph flows
    def add_section_content(text: str, default_placeholder: str = ""):
        content_text = text or default_placeholder
        if not content_text:
            return
        
        lines = content_text.split('\n')
        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue
            
            # Check for bullet format
            if trimmed.startswith('*') or trimmed.startswith('-') or trimmed.startswith('•'):
                # Extract content after bullet character
                bullet_content = trimmed[1:].strip()
                story.append(Paragraph(f"&bull; {bullet_content}", bullet_style))
            else:
                story.append(Paragraph(trimmed, body_style))

    # Helper function to add Section headers with solid horizontal lines
    def add_section_header(title: str):
        story.append(Paragraph(title.upper(), section_title_style))
        story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#000000'), spaceAfter=6, spaceBefore=1))

    # 1. Header Block
    name_str = emp.name.upper() if emp.name else "EMPLOYEE NAME"
    story.append(Paragraph(name_str, title_style))
    
    job_title_str = getattr(emp, 'job_title', 'TECHNICAL ASSOCIATE').upper()
    story.append(Paragraph(job_title_str, subtitle_style))
    
    # Contact Row: linkedin, email, phone, location
    linkedin_val = getattr(emp, 'linkedin', 'www.linkedin.com/in/username') or 'www.linkedin.com/in/username'
    email_val = getattr(emp, 'email', 'username@gmail.com') or 'username@gmail.com'
    phone_val = getattr(emp, 'phone', '+91-0000000000') or '+91-0000000000'
    location_val = getattr(emp, 'location', 'HYDERABAD, INDIA') or 'HYDERABAD, INDIA'
    
    contact_parts = [
        f"<a href='https://{linkedin_val}' color='black'><u>{linkedin_val}</u></a>",
        email_val,
        phone_val,
        location_val
    ]
    contact_str = " &nbsp;&#9830;&nbsp; ".join(contact_parts)
    story.append(Paragraph(contact_str, contact_style))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor('#000000'), spaceAfter=10, spaceBefore=2))

    # 2. Executive Summary
    add_section_header("EXECUTIVE SUMMARY")
    add_section_content(getattr(emp, 'executive_summary', ''), "Write about your overall experience")

    # 3. Core Competencies
    add_section_header("CORE COMPETENCIES")
    add_section_content(getattr(emp, 'core_competencies', ''), "List your Skills and write 1 liner about each skill")

    # 4. Key Clients Supported
    add_section_header("KEY CLIENTS SUPPORTED")
    add_section_content(getattr(emp, 'key_clients', ''), "Mention the clients you supported")

    # 5. Professional Experience
    add_section_header("PROFESSIONAL EXPERIENCE – LIST FROM THE CURRENT JOB TO FIRST JOB")
    
    # Arohak Technologies Job Entry
    arohak_company = "AROHAK INC"
    arohak_loc = "Hyderabad, India"
    arohak_role = getattr(emp, 'arohak_title', '') or getattr(emp, 'job_title', 'Technical Associate')
    arohak_dates = getattr(emp, 'arohak_start', 'Dec 2025 – Present') or 'Dec 2025 – Present'
    
    arohak_header = f"<b>{arohak_company} | {arohak_loc} | {arohak_role}</b> &nbsp;&nbsp;&nbsp;&nbsp;(Start Date) {arohak_dates}"
    story.append(Paragraph(arohak_header, body_style))
    add_section_content(getattr(emp, 'arohak_resp', ''), "Summaries your Job role in Arohak , Roles & Responsibilities")
    
    story.append(Spacer(1, 6))
    
    # Previous Company Job Entry
    prev_company_val = getattr(emp, 'prev_company', 'Previous company Name') or 'Previous company Name'
    prev_loc_val = getattr(emp, 'prev_location', 'Location') or 'Location'
    prev_title_val = getattr(emp, 'prev_title', 'Job Title') or 'Job Title'
    prev_tenure_val = getattr(emp, 'prev_tenure', 'Tenure ( Start Date – End Date)') or 'Tenure ( Start Date – End Date)'
    
    prev_header = f"<b>{prev_company_val} | {prev_loc_val} | {prev_title_val} | {prev_tenure_val}</b>"
    story.append(Paragraph(prev_header, body_style))
    add_section_content(getattr(emp, 'prev_resp', ''), "Summaries your Job role in your company , Roles & Responsibilities")

    # 6. Career Achievements
    add_section_header("CAREER ACHIEVEMENTS")
    add_section_content(getattr(emp, 'achievements', ''), "List your achievements throughout your career")

    # 7. Education
    add_section_header("EDUCATION")
    add_section_content(getattr(emp, 'education', ''), "List your educational achievements with details about your college and pass out year (MM/YYYY)")

    # 8. Industry Experience
    add_section_header("INDUSTRY EXPERIENCE")
    add_section_content(getattr(emp, 'industry_experience', ''), "List the industry that you have experience : EX : Banking & Financial Services | Manufacturing | Retail & Consumer Goods | Energy & Utilities | Enterprise Technology Services | Infrastructure & Managed Services")

    # 9. Certifications
    add_section_header("CERTIFICATIONS")
    add_section_content(getattr(emp, 'certifications', ''), "List your certifications . Name of the certification , Exam ID and pass out year and month")

    # 10. Tools & Technologies
    add_section_header("TOOLS & TECHNOLOGIES")
    add_section_content(getattr(emp, 'tools_technologies', ''), "List your skills: EX : ServiceNow, SAP")

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
