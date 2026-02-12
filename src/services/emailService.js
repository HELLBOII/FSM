import { format } from 'date-fns';

// Primary color values (HSL: 152 45% 28% = Forest Green)
const PRIMARY_COLOR = '#1a5d3a'; // Main primary color
const PRIMARY_LIGHT = '#2a7d4a'; // Lighter shade for gradients
const PRIMARY_DARK = '#0f3d26'; // Darker shade
const PRIMARY_FOREGROUND = '#ffffff'; // White text on primary

/**
 * Email Service - Send email notifications using nodemailer via API
 * Note: nodemailer requires a Node.js backend. This service calls a backend API endpoint.
 */
export const emailService = {
  /**
   * Send email notification via API endpoint (using nodemailer on backend)
   * @param {Object} emailData - { to, subject, html, text }
   * @returns {Promise<Object>}
   */
  async sendEmail(emailData) {
    try {
      // Call backend API endpoint that uses nodemailer
      // nodemailer cannot run in the browser - it must run on a Node.js backend
      const apiUrl = import.meta.env.EMAIL_API || 'https://fsmbackend.vercel.app';
      
      const response = await fetch(`${apiUrl}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailData.to,
          from: import.meta.env.VITE_EMAIL_USER,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send email' }));
        return { success: false, error: errorData.error || 'Failed to send email' };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Silently handle all errors (connection refused, network errors, etc.)
      // Don't log to console to prevent noise when backend is not available
      return { success: false, error: 'Email service unavailable' };
    }
  },

  /**
   * Send service request notification to client
   * @param {Object} requestData - Service request data
   * @param {Object} clientData - Client data with email
   * @param {boolean} isUpdate - Whether this is an update or new request
   * @returns {Promise<Object>}
   */
  async sendClientNotification(requestData, clientData, isUpdate = false) {
    if (!clientData.email) {
      console.warn('Client email not found, skipping email notification');
      return { success: false, error: 'Client email not found' };
    }

    const requestNumber = requestData.request_number || 'N/A';
    const visitDate = requestData.scheduled_start_time 
      ? format(new Date(requestData.scheduled_start_time), 'PP')
      : 'Not scheduled';
    const startTime = requestData.scheduled_start_time 
      ? format(new Date(requestData.scheduled_start_time), 'PPpp')
      : 'Not scheduled';
    const endTime = requestData.scheduled_end_time 
      ? format(new Date(requestData.scheduled_end_time), 'pp')
      : '';
    const timeSlot = requestData.scheduled_start_time && requestData.scheduled_end_time
      ? `${format(new Date(requestData.scheduled_start_time), 'pp')} to ${format(new Date(requestData.scheduled_end_time), 'pp')}`
      : 'Not scheduled';
    
    const subject = `Technician Assigned - Service Request ${requestNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0 auto; padding: 8px;">
        <div style="background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: ${PRIMARY_FOREGROUND}; margin: 0; font-size: 24px;">${import.meta.env.VITE_COMPANY_NAME}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Field Service Management</p>
        </div>
        
        <div style="background: #ffffff; padding: 8px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="color: #4b5563; font-size: 12px; margin-bottom: 10px;">
            Dear ${clientData.name || 'Valued Client'},
          </p>
          
            <p style="color: #4b5563; font-size: 12px; margin-bottom: 10px;">
            We are pleased to inform you that a technician has been assigned for your service request.
          </p>
          
          <div style="background: #f9fafb; border-left: 4px solid ${PRIMARY_COLOR}; padding: 8px; margin: 0; border-radius: 4px;">
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Service Request No : ${requestNumber}</p>
            ${requestData.assigned_technician_name ? `<p style="color: #1f2937; font-size: 12px; margin: 0;">Technician Name    : ${requestData.assigned_technician_name}</p>` : ''}
            ${requestData.technician_mobile ? `<p style="color: #1f2937; font-size: 12px; margin: 0;">Technician Contact : ${requestData.technician_mobile}</p>` : ''}
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Visit Date         : ${visitDate}</p>
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Time Slot          : ${timeSlot}</p>
          </div>
          
          <p style="color: #4b5563; font-size: 12px; margin-top: 10px;">
            Our technician will visit as per the scheduled time. 
            If you need to reschedule, please contact us at ${import.meta.env.VITE_SUPPORT_NUMBER}.
          </p>
          
          <p style="color: #4b5563; font-size: 12px; margin-top: 10px;">
            Thank you for your cooperation.
          </p>
          
          <p style="color: #4b5563; font-size: 12px; margin-top: 20px;">
            Best Regards,<br>
            <strong style="color: ${PRIMARY_COLOR};">${import.meta.env.VITE_COMPANY_NAME}</strong>
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
        Dear ${clientData.name || 'Valued Client'},

        We are pleased to inform you that a technician has been assigned for your service request.

        Service Request No : ${requestNumber}
        ${requestData.assigned_technician_name ? `Technician Name    : ${requestData.assigned_technician_name}` : ''}
        ${requestData.technician_mobile ? `Technician Contact : ${requestData.technician_mobile}` : ''}
        Visit Date         : ${visitDate}
        Time Slot          : ${timeSlot}

        Our technician will visit as per the scheduled time. 
        If you need to reschedule, please contact us at ${import.meta.env.VITE_SUPPORT_NUMBER}.

        Thank you for your cooperation.

        Best Regards,
        ${import.meta.env.VITE_COMPANY_NAME}
    `;

    return await this.sendEmail({
      to: clientData.email,
      from: import.meta.env.VITE_EMAIL_USER,
      subject,
      html,
      text
    });
  },

  /**
   * Send service request notification to technician
   * @param {Object} requestData - Service request data
   * @param {Object} technicianData - Technician data with email
   * @param {boolean} isUpdate - Whether this is an update or new request
   * @returns {Promise<Object>}
   */
  async sendTechnicianNotification(requestData, technicianData, isUpdate = false) {
    if (!technicianData.email) {
      console.warn('Technician email not found, skipping email notification');
      return { success: false, error: 'Technician email not found' };
    }

    const requestNumber = requestData.request_number || 'N/A';
    const visitDate = requestData.scheduled_start_time 
      ? format(new Date(requestData.scheduled_start_time), 'PP')
      : 'Not scheduled';
    const startTime = requestData.scheduled_start_time 
      ? format(new Date(requestData.scheduled_start_time), 'PPpp')
      : 'Not scheduled';
    const endTime = requestData.scheduled_end_time 
      ? format(new Date(requestData.scheduled_end_time), 'pp')
      : '';
    const timeSlot = requestData.scheduled_start_time && requestData.scheduled_end_time
      ? `${format(new Date(requestData.scheduled_start_time), 'pp')} to ${format(new Date(requestData.scheduled_end_time), 'pp')}`
      : 'Not scheduled';
    
    // Get client data - clientData should be passed or we need to get it from requestData
    const clientName = requestData.client_name || 'N/A';
    const clientPhone = requestData.contact_phone || 'N/A';
    const clientAddress = requestData.location?.address || requestData.address || 'N/A';
    const serviceType = (requestData.irrigation_type || '').replace(/_/g, ' ');
    
    const subject = `New Service Request Assigned - ${requestNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0 auto; padding: 8px;">
        <div style="background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%); padding: 8px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: ${PRIMARY_FOREGROUND}; margin: 0; font-size: 24px;">${import.meta.env.VITE_COMPANY_NAME}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Field Service Management</p>
        </div>
        
        <div style="background: #ffffff; padding: 8px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="color: #4b5563; font-size: 12px; margin-bottom: 10px;">
            Hello ${requestData.assigned_technician_name || technicianData.name || 'Technician'},
          </p>
          
          <p style="color: #4b5563; font-size: 12px; margin-bottom: 10px;">
            A new service request has been assigned to you.
          </p>
          
          <div style="background: #f9fafb; border-left: 4px solid ${PRIMARY_COLOR}; padding: 8px; border-radius: 4px;">
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Service Request No :  ${requestNumber}</p>
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Customer Name      : ${clientName}</p>
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Contact Number     : ${clientPhone}</p>
            ${serviceType ? `<p style="color: #1f2937; font-size: 12px; margin: 0;">Service Type       : ${serviceType}</p>` : ''}
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Visit Date         : ${visitDate}</p>
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Time Slot          : ${timeSlot}</p>
            <p style="color: #1f2937; font-size: 12px; margin: 0;">Service Address    : ${clientAddress}</p>
          </div>
          
          <p style="color: #4b5563; font-size: 12px; margin-top: 10px;">
            Please log in to the Field Service App to view complete details and update status accordingly.
          </p>
          
          <p style="color: #4b5563; font-size: 12px; margin-top: 10px;">
            Kindly ensure timely visit and professional service.
          </p>
          
          <p style="color: #4b5563; font-size: 12px; margin-top: 20px;">
            Regards,<br>
            <strong style="color: ${PRIMARY_COLOR};">Service Coordination Team</strong><br>
            <strong style="color: ${PRIMARY_COLOR};">${import.meta.env.VITE_COMPANY_NAME}</strong>
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Hello ${requestData.assigned_technician_name || technicianData.name || 'Technician'},

      A new service request has been assigned to you.

      Service Request No :  ${requestNumber}
      Customer Name      : ${clientName}
      Contact Number     : ${clientPhone}
      ${serviceType ? `Service Type       : ${serviceType}` : ''}
      Visit Date         : ${visitDate}
      Time Slot          : ${timeSlot}
      Service Address    : ${clientAddress}

      Please log in to the Field Service App to view complete details and update status accordingly.

      Kindly ensure timely visit and professional service.

      Regards,
      Service Coordination Team
      ${import.meta.env.VITE_COMPANY_NAME}
    `;

    return await this.sendEmail({
      to: technicianData.email,
      from: import.meta.env.VITE_EMAIL_USER,
      subject,
      html,
      text
    });
  }
};


