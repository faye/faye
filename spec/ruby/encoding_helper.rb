module EncodingHelper
  def encode(string)
    return string unless string.respond_to?(:force_encoding)
    string.force_encoding("UTF-8")
  end
end
