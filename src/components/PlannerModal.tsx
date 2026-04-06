import React from 'react';
import { X, Sparkles, Clipboard, Printer, AlertTriangle } from 'lucide-react';

interface PlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  result: string;
}

const PlannerModal: React.FC<PlannerModalProps> = ({ isOpen, onClose, isLoading, result }) => {
  if (!isOpen) return null;

  // Function to format the plain text result with proper styling and markdown support
  const formatItinerary = (text: string) => {
    if (!text) return '';
    
    // Split by lines and process each line
    const lines = text.split('\n');
    let formattedContent = '';
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        formattedContent += '<br>';
        return;
      }
      
      // Process markdown formatting in the line
      let processedLine = trimmedLine;
      
      // Convert **bold** to <strong>
      processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Convert *italic* to <em>
      processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // Main section headers (with emojis)
      if (trimmedLine.match(/^[🌅🌞🌆💡🚗].+/)) {
        formattedContent += `<h3 class="text-xl font-bold text-primary mt-6 mb-4 flex items-center gap-2">${processedLine}</h3>`;
      }
      // Time entries (like "8:00 AM - 9:30 AM:")
      else if (trimmedLine.match(/^\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/)) {
        formattedContent += `<h4 class="text-lg font-semibold text-secondary mt-4 mb-2">${processedLine}</h4>`;
      }
      // Activity names or important points (lines starting with capital letter and ending with colon)
      else if (trimmedLine.match(/^[A-Z].+:$/)) {
        formattedContent += `<h4 class="text-lg font-semibold text-secondary mt-3 mb-2">${processedLine}</h4>`;
      }
      // Bullet points or list items (starting with -, •, or *)
      else if (trimmedLine.match(/^[-•*]\s/)) {
        formattedContent += `<p class="text-main-secondary mb-2 ml-4 leading-relaxed">${processedLine}</p>`;
      }
      // Regular paragraphs
      else {
        formattedContent += `<p class="text-main-secondary mb-3 leading-relaxed">${processedLine}</p>`;
      }
    });
    
    return formattedContent;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="modal-content rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline bg-surface-container-high">
          <h3 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <Sparkles size={22} className="text-primary" />
            Your AI-Generated Itinerary
          </h3>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-full hover:bg-surface-container transition-colors text-text-secondary hover:text-error"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="p-6 md:p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12">
              <div className="loader mb-6"></div>
              <h4 className="text-xl font-semibold text-primary mb-2">Building your perfect day...</h4>
              <p className="text-main-secondary text-center max-w-md">
                Our AI is analyzing your selected activities and creating an optimized itinerary with perfect timing and flow.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Formatted itinerary content */}
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: formatItinerary(result) }}
              />
              
              {/* Action buttons */}
              <div className="mt-8 pt-6 border-t border-outline flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result);
                    // Could add a toast notification here
                  }}
                  className="filter-btn flex items-center gap-2"
                >
                  <Clipboard size={16} /> Copy Itinerary
                </button>
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>My Travel Itinerary</title>
                            <style>
                              body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                              h3 { color: #000; font-size: 1.5rem; margin-top: 2rem; }
                              h4 { color: #666; font-size: 1.25rem; margin-top: 1rem; }
                              p { margin-bottom: 1rem; }
                              strong { font-weight: bold; }
                              em { font-style: italic; }
                            </style>
                          </head>
                          <body>
                            ${formatItinerary(result)}
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  className="filter-btn flex items-center gap-2"
                >
                  <Printer size={16} /> Print Itinerary
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-error" />
              </div>
              <h4 className="text-lg font-semibold text-error mb-2">Something went wrong</h4>
              <p className="text-main-secondary">
                We couldn't generate your itinerary. Please try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlannerModal;