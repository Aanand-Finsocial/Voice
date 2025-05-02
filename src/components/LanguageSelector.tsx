import React from "react";

interface LanguageSelectorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ maxWidth: "280px", width: "90%" }}>
        <select
          value={value}
          onChange={onChange}
          className="appearance-none bg-transparent border border-blue-400 text-white rounded-full py-2 px-4 pr-12 focus:outline-none focus:border-blue-500 text-center w-full"
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.8)",
            fontSize: "1rem",
            fontWeight: "500"
          }}
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी (Hindi)</option>
          <option value="bn">বাংলা (Bengali)</option>
          <option value="gu">ગુજરાતી (Gujarati)</option>
          <option value="kn">ಕನ್ನಡ (Kannada)</option>
          <option value="ml">മലയാളം (Malayalam)</option>
          <option value="mr">मराठी (Marathi)</option>
          <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
          <option value="ta">தமிழ் (Tamil)</option>
          <option value="te">తెలుగు (Telugu)</option>
          <option value="ur">اردو (Urdu)</option>
        </select>
        
        {/* Custom dropdown arrow - white color explicitly set */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
          <svg className="w-4 h-4" fill="white" viewBox="0 0 20 20" style={{color: "white"}}>
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;